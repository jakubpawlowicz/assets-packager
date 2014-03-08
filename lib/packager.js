var fs = require('fs');
var path = require('path');
var util = require('util');
var zlib = require('zlib');
var uglify = require('uglify-js');
var less = require('less');
var async = require('async');
var crypto = require('crypto');
var CleanCSS = require('clean-css');
var EnhanceCSS = require('enhance-css');
var AssetsExpander = require('assets-expander');

var isWindows = process.platform == 'win32';

var Packager = function(options) {
  var expander = new AssetsExpander(options.config, { root: options.root });
  var allTypes = expander.allTypes();
  var extensions = { stylesheets: 'css', javascripts: 'js' };

  var cacheFile = path.join(path.dirname(options.config), '.' + path.basename(options.config) + '.json');
  var cacheData = fs.existsSync(cacheFile) ?
    JSON.parse(fs.readFileSync(cacheFile, 'utf8')) :
    {};

  var precompileStylesheets = function(callback) {
    if ((options.only && !options.only.hasCSS) || allTypes.indexOf('stylesheets') == -1)
      return callback();

    var lessPath = options.path.stylesheets + '/**/*';
    var expanderOptions = {
      type: 'less',
      root: options.root
    };
    var files = expander.processList(lessPath, expanderOptions);

    util.puts('Compiling ' + files.length + ' Less file(s) to CSS...');
    async.mapLimit(files, options.concurrent, compileLess, callback);
  };

  var processAssets = function(type) {
    return function(callback) {
      if (type == 'stylesheets' && options.only && !options.only.hasCSS)
        return callback();
      if (type == 'javascripts' && options.only && !options.only.hasJS)
        return callback();
      if (allTypes.indexOf(type) == -1)
        return callback();

      util.puts("Processing type '" + type + "'...");

      var groups = expander.groupsFor(type);
      async.eachLimit(groups, options.concurrent, function(group, localCallback) {
        if (!options.only || options.only.has(group + '.' + extensions[type]))
          processor[type](group, localCallback);
        else
          localCallback();
      }, callback);
    };
  };

  var generateCacheBoosters = function(callback) {
    if (!options.cacheBoosters)
      return callback();

    util.puts('Writing cache boosters config file.');
    fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8', callback);
  };

  var calculateMD5Stamp = function(data) {
    var hash = crypto.createHash('md5');
    hash.update(data.toString('utf8'));
    return hash.digest('hex');
  };

  var makeDir = function(dir) {
    var toRoot = path.relative(options.root, dir);
    var currentDir = options.root;

    toRoot.split(isWindows ? '\\' : '/').forEach(function(part) {
      currentDir = path.join(currentDir, part);
      if (!fs.existsSync(currentDir))
        fs.mkdirSync(currentDir, 0775);
    });
  };

  var compileLess = function(filename, callback) {
    fs.readFile(filename, 'utf-8', function(error, data) {
      util.puts("  Compiling '" + path.basename(filename) + "'...");

      new (less.Parser)({
        paths: [path.dirname(filename)],
        filename: filename,
        optimizations: 1
      }).parse(data, function(error, tree) {
        if (error)
          throw new Error(filename + ': ' + util.inspect(error));

        try {
          var css = tree.toCSS();
          fs.writeFile(filename.replace('.less', '.css'), css, 'utf-8', callback);
        } catch (error) {
          throw new Error(filename + ': ' + util.inspect(error));
        }
      });
    });
  };

  var readFile = function(file, callback) {
    fs.readFile(file, 'utf-8', callback);
  };

  var optimizeScripts = function(data, callback) {
    var isCufon = /Cufon\.registerFont/.test(data);
    var ast = uglify.parser.parse(data);
    var optimized = '';

    if (isCufon || options.noMinifyJS) {
      // Maybe no minification was required. We also skip mangling for Cufon as it doesn't like it.
      /* jshint camelcase:false */
      optimized = uglify.uglify.gen_code(ast, { beautify: true, indent_level: options.indentLevel });
    } else {
      ast = uglify.uglify.ast_mangle(ast);
      ast = uglify.uglify.ast_squeeze(ast);
      optimized = uglify.uglify.gen_code(ast);
      optimized = options.lineBreakAt ?
        uglify.uglify.split_lines(optimized, options.lineBreakAt) :
        optimized;
      /* jshint camelcase:true */
    }

    callback(null, optimized);
  };

  var writeScripts = function(groupPath, data) {
    return function(callback) {
      fs.writeFile(groupPath, data, 'utf-8', callback);
    };
  };

  var writeCompressedScripts = function(groupPath, data) {
    return function(callback) {
      if (!options.gzip)
        return callback();

      zlib.gzip(data, function(error, compressedData) {
        if (error)
          throw error;

        fs.writeFile(groupPath + '.gz', compressedData, callback);
      });
    };
  };

  var optimizeStyles = function(data, callback) {
    new CleanCSS().minify(data, function(error, minified) {
      new EnhanceCSS({
        rootPath: options.root,
        pregzip: true,
        noEmbedVersion: options.noEmbedVersion,
        assetHosts: options.assetHosts,
        cryptedStamp: options.cacheBoosters
      }).process(minified, callback);
    });
  };

  var writeEmbeddedStyles = function(groupPath, data) {
    return function(callback) {
      fs.writeFile(groupPath, data.embedded.plain, 'utf-8', callback);
    };
  };

  var writeEmbeddedCompressedStyles = function(groupPath, data) {
    return function(callback) {
      if (!options.gzip)
        return callback();

      fs.writeFile(groupPath + '.gz', data.embedded.compressed, 'utf-8', callback);
    };
  };

  var writePlainStyles = function(groupPath, data) {
    return function(callback) {
      if (!options.noEmbedVersion)
        return callback();

      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets);
      fs.writeFile(filename, data.notEmbedded.plain, 'utf-8', callback);
    };
  };

  var writePlainCompressedStyles = function(groupPath, data) {
    return function(callback) {
      if (!options.gzip || !options.noEmbedVersion)
        return callback();

      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets) + '.gz';
      fs.writeFile(filename, data.notEmbedded.compressed, 'utf-8', callback);
    };
  };

  var inAssetsGroup = function(type, group, callback) {
    var files = expander.processGroup(type, group, {
      type: extensions[type],
      path: options.path[type]
    });
    var groupPath = path.join(options.root, options.bundledPath[type], group + '.' + extensions[type]);
    var groupDir = path.dirname(groupPath);
    var stampFilename = function(data) {
      var groupHash = calculateMD5Stamp(data);
      cacheData[type + '/' + group] = groupHash;
      return path.join(options.root, options.bundledPath[type], group) + '-' + groupHash + '.' + extensions[type];
    };

    makeDir(groupDir);
    callback(groupPath, files, stampFilename);
  };

  var processor = {};

  processor.javascripts = function(group, callback) {
    inAssetsGroup('javascripts', group, function(filename, files, stampFilename) {
      async.map(files, readFile, function(error, data) {
        optimizeScripts(data.join(''), function(error, optimized) {
          if (options.cacheBoosters)
            filename = stampFilename(optimized);

          async.parallel([
            writeScripts(filename, optimized),
            writeCompressedScripts(filename, optimized)
          ], function() {
            util.puts("  Processed javascripts group '" + group + "' - squeezing " + files.length + " file(s)");
            callback();
          });
        });
      });
    });
  };

  processor.stylesheets = function(group, callback) {
    inAssetsGroup('stylesheets', group, function(filename, files, stampFilename) {
      async.map(files, readFile, function(error, data) {
        optimizeStyles(data.join(''), function(error, optimized) {
          if (options.cacheBoosters)
            filename = stampFilename(optimized.embedded.plain);

          async.parallel([
            writeEmbeddedStyles(filename, optimized),
            writeEmbeddedCompressedStyles(filename, optimized),
            writePlainStyles(filename, optimized),
            writePlainCompressedStyles(filename, optimized)
          ], function() {
            util.puts("  Processed stylesheets group '" + group + "' - squeezing " + files.length + " file(s)");
            callback();
          });
        });
      });
    });
  };

  this.process = function() {
    async.series({
      precompile: precompileStylesheets,
      processStyles: processAssets('stylesheets'),
      processScripts: processAssets('javascripts'),
      generateCache: generateCacheBoosters
    });
  };
};

module.exports = Packager;
