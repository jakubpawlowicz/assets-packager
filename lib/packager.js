(function() {
  var fs = require('fs');
  var path = require('path');
  var util = require('util');
  var zlib = require('zlib');

  var AssetsExpander = require('assets-expander');
  var async = require('async');
  var CleanCSS = require('clean-css');
  var crypto = require('crypto');
  var EnhanceCSS = require('enhance-css');
  var less = require('less');
  var uglify = require('uglify-js');

  var isWindows = process.platform == 'win32';

  var noop = function(callback) {
    callback();
  };

  var readFile = function(file, callback) {
    fs.readFile(file, 'utf-8', callback);
  };

  var calculateMD5Stamp = function(data) {
    var hash = crypto.createHash('md5');
    hash.update(data.toString('utf8'));
    return hash.digest('hex');
  };

  var makeDir = function(root, dir) {
    var toRoot = path.relative(root, dir);
    var currentDir = root;

    toRoot.split(isWindows ? '\\' : '/').forEach(function(part) {
      currentDir = path.join(currentDir, part);
      if (fs.existsSync(currentDir))
        return;

      try {
        fs.mkdirSync(currentDir, 0775);
      } catch (e) {
        if (e.message.indexOf('EEXIST') == -1)
          throw e;
      }
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

  var optimizeScripts = function(data, options, callback) {
    var isCufon = /Cufon\.registerFont/.test(data);

    if (!isCufon && options.js.minify) {
      /* jshint camelcase:false */
      var uglifyOptions = {
        compress: true,
        fromString: true,
        output: {
          max_line_len: options.js.lineBreakAt || 0
        }
      };

      data = uglify.minify(data, uglifyOptions).code;
      /* jshint camelcase:true */

      if (isWindows)
        data = data.replace(/\n/g, '\r\n');
    }

    callback(null, data);
  };

  var writeScripts = function(groupPath, data) {
    return function(callback) {
      fs.writeFile(groupPath, data, 'utf-8', callback);
    };
  };

  var writeCompressedScripts = function(groupPath, data) {
    return function(callback) {
      zlib.gzip(data, function(error, compressedData) {
        if (error)
          throw error;

        fs.writeFile(groupPath + '.gz', compressedData, callback);
      });
    };
  };

  var optimizeStyles = function(data, options, callback) {
    new CleanCSS().minify(data, function(error, minified) {
      new EnhanceCSS({
        rootPath: options.root,
        pregzip: options.gzip,
        forceEmbed: options.css.embedAll,
        noEmbedVersion: options.css.safeEmbed,
        assetHosts: options.css.assetHosts,
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
      fs.writeFile(groupPath + '.gz', data.embedded.compressed, 'utf-8', callback);
    };
  };

  var writePlainStyles = function(groupPath, data) {
    return function(callback) {
      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets);
      fs.writeFile(filename, data.notEmbedded.plain, 'utf-8', callback);
    };
  };

  var writePlainCompressedStyles = function(groupPath, data) {
    return function(callback) {
      var filename = groupPath.replace('.' + extensions.stylesheets, '-noembed.' + extensions.stylesheets) + '.gz';
      fs.writeFile(filename, data.notEmbedded.compressed, 'utf-8', callback);
    };
  };

  var extensions = {
    stylesheets: 'css',
    javascripts: 'js'
  };

  var AssetsPackager = function(options) {
    options = options || {};
    var expander = new AssetsExpander(options.config, { root: options.root });
    var allTypes = expander.allTypes();

    var cacheFile = path.join(
      path.dirname(options.config),
      '.' + path.basename(options.config) + '.json'
    );
    var cacheData = fs.existsSync(cacheFile) ?
      JSON.parse(fs.readFileSync(cacheFile, 'utf8')) :
      {};

    var precompileStylesheets = function(callback) {
      var scriptsOnly = options.only && !options.only.hasCSS;
      var noStyles = allTypes.indexOf('stylesheets') == -1;
      if (scriptsOnly || noStyles)
        return callback();

      var lessPath = options.css.source + '/**/*';
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
            processors[type](group, localCallback);
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

    var inAssetsGroup = function(type, group, callback) {
      var extension = extensions[type];
      var bundleTo = options[extension].bundleTo;
      var files = expander.processGroup(type, group, {
        type: extension,
        path: options[extension].source
      });
      var groupPath = path.join(options.root, bundleTo, group + '.' + extension);
      var groupDir = path.dirname(groupPath);

      var stampFilename = function(data) {
        var groupHash = calculateMD5Stamp(data);
        cacheData[type + '/' + group] = groupHash;
        return path.join(options.root, bundleTo, group) +  '-' + groupHash + '.' + extension;
      };

      makeDir(options.root, groupDir);
      callback(groupPath, files, stampFilename);
    };

    var processors = {};

    processors.javascripts = function(group, callback) {
      inAssetsGroup('javascripts', group, function(filename, files, stampFilename) {
        async.map(files, readFile, function(error, data) {
          optimizeScripts(data.join(''), options, function(error, optimized) {
            if (options.cacheBoosters)
              filename = stampFilename(optimized);

            async.parallel([
              writeScripts(filename, optimized),
              options.gzip ?
                writeCompressedScripts(filename, optimized) :
                noop
            ], function() {
              util.puts("  Processed javascripts group '" + group + "' - squeezing " + files.length + " file(s)");
              callback();
            });
          });
        });
      });
    };

    processors.stylesheets = function(group, callback) {
      inAssetsGroup('stylesheets', group, function(filename, files, stampFilename) {
        async.map(files, readFile, function(error, data) {
          optimizeStyles(data.join(''), options, function(error, optimized) {
            if (options.cacheBoosters)
              filename = stampFilename(optimized.embedded.plain);

            async.parallel([
              writeEmbeddedStyles(filename, optimized),
              options.gzip ?
                writeEmbeddedCompressedStyles(filename, optimized) :
                noop,
              options.css.safeEmbed ?
                writePlainStyles(filename, optimized) :
                noop,
              options.gzip && options.css.safeEmbed ?
                writePlainCompressedStyles(filename, optimized) :
                noop
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

  module.exports = AssetsPackager;
})();
