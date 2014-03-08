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

  var steps = {
    precompileStylesheets: function(callback) {
      if ((options.only && !options.only.hasCSS) || allTypes.indexOf('stylesheets') == -1)
        return callback();

      var lessPath = options.path.stylesheets + '/**/*';
      var expanderOptions = {
        type: 'less',
        root: options.root
      };
      var files = expander.processList(lessPath, expanderOptions);

      util.puts('Compiling ' + files.length + ' Less file(s) to CSS...');
      async.mapLimit(files, options.concurrent, compileLESSToCSS, callback);
    },

    processAssets: function(type, callback) {
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
          process[type](group, localCallback);
        else
          localCallback();
      }, callback);
    },

    generateCacheBoosters: function(callback) {
      if (!options.cacheBoosters)
        return callback();

      util.puts('Writing cache boosters config file.');
      fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8', callback);
    }
  };

  // Calculates MD5 hash for cache boosters
  var cacheHash = function(data) {
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

  var compileLESSToCSS = function(filename, callback) {
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

  var writeJavaScript = function(groupPath, data) {
    return function(callback) {
      fs.writeFile(groupPath, data, 'utf-8', callback);
    };
  };

  var writeCompressedJavaScript = function(groupPath, data) {
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

  var optimizeCSS = function(data, callback) {
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

  var writeEmbeddedCSS = function(groupPath, data) {
    return function(callback) {
      fs.writeFile(groupPath, data.embedded.plain, 'utf-8', callback);
    };
  };

  var writeEmbeddedCompressedCSS = function(groupPath, data) {
    return function(callback) {
      if (!options.gzip)
        return callback();

      fs.writeFile(groupPath + '.gz', data.embedded.compressed, 'utf-8', callback);
    };
  };

  var writePlainCSS = function(groupPath, data) {
    return function(callback) {
      if (!options.noEmbedVersion)
        return callback();

      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets);
      fs.writeFile(filename, data.notEmbedded.plain, 'utf-8', callback);
    };
  };

  var writePlainCompressedCSS = function(groupPath, data) {
    return function(callback) {
      if (!options.gzip || !options.noEmbedVersion)
        return callback();

      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets) + '.gz';
      fs.writeFile(filename, data.notEmbedded.compressed, 'utf-8', callback);
    };
  };

  // Processes group of files, outputting bundled & gzipped files
  var process = {};

  process.javascripts = function(group, callback) {
    var files = expander.processGroup('javascripts', group, {
      type: extensions.javascripts,
      path: options.path.javascripts
    });
    var groupPath = path.join(options.root, options.bundledPath.javascripts, group + '.' + extensions.javascripts);
    var groupDir = path.dirname(groupPath);
    var stampFilename = function(data) {
      var groupHash = cacheHash(data);
      cacheData['javascripts/' + group] = groupHash;
      groupPath = path.join(options.root, options.bundledPath.javascripts, group) + '-' + groupHash + '.' + extensions.javascripts;
    };

    makeDir(groupDir);

    async.map(files, readFile, function(error, data) {
      optimizeScripts(data.join(''), function(error, optimized) {
        if (options.cacheBoosters)
          stampFilename(optimized);

        async.parallel([
          writeJavaScript(groupPath, optimized),
          writeCompressedJavaScript(groupPath, optimized)
        ], function() {
          util.puts("  Processed javascripts group '" + group + "' - squeezing " + files.length + " file(s)");
          callback();
        });
      });
    });
  };

  process.stylesheets = function(group, callback) {
    var files = expander.processGroup('stylesheets', group, {
      type: extensions.stylesheets,
      path: options.path.stylesheets
    });
    var groupPath = path.join(options.root, options.bundledPath.stylesheets, group + '.' + extensions.stylesheets);
    var groupDir = path.dirname(groupPath);
    var stampFilename = function(data) {
      var groupHash = cacheHash(data);
      cacheData['stylesheets/' + group] = groupHash;
      groupPath = path.join(options.root, options.bundledPath.stylesheets, group) + '-' + groupHash + '.' + extensions.stylesheets;
    };

    makeDir(groupDir);

    async.map(files, readFile, function(error, data) {
      optimizeCSS(data.join(''), function(error, optimized) {
        if (options.cacheBoosters)
          stampFilename(optimized.embedded.plain);

        async.parallel([
          writeEmbeddedCSS(groupPath, optimized),
          writeEmbeddedCompressedCSS(groupPath, optimized),
          writePlainCSS(groupPath, optimized),
          writePlainCompressedCSS(groupPath, optimized)
        ], function() {
          util.puts("  Processed stylesheets group '" + group + "' - squeezing " + files.length + " file(s)");
          callback();
        });
      });
    });
  };

  this.process = function() {
    async.series({
      precompile: steps.precompileStylesheets,
      processStyles: function(callback) { steps.processAssets('stylesheets', callback); },
      processScripts: function(callback) { steps.processAssets('javascripts', callback); },
      generateCache: steps.generateCacheBoosters
    });
  };
};

module.exports = Packager;
