var fs = require('fs');
var path = require('path');
var util = require('util');
var zlib = require('zlib');
var uglify = require('uglify-js');
var less = require('less');
var Seq = require('seq');
var crypto = require('crypto');
var cleanCSS = require('clean-css');
var EnhanceCSS = require('enhance-css');
var AssetsExpander = require('assets-expander');
var existsSync = fs.existsSync || path.existsSync;

var isWindows = process.platform == 'win32';

var Packager = function(options) {
  var expander = new AssetsExpander(options.config, { root: options.root });
  var extensions = { stylesheets: 'css', javascripts: 'js' };

  var cacheFile = path.join(path.dirname(options.config), "." + path.basename(options.config) + '.json');
  var cacheData = existsSync(cacheFile) ?
    JSON.parse(fs.readFileSync(cacheFile, 'utf8')) :
    {};

  var steps = {
    precompileStylesheets: function(type) {
      if (type == 'stylesheets' && (!options.only || options.only.hasCSS)) {
        compileLessToCss(type, this);
      } else {
        this(null);
      }
    },

    processAssets: function(type) {
      if (type == 'stylesheets' && options.only && !options.only.hasCSS)
        return this(null);
      if (type == 'javascripts' && options.only && !options.only.hasJS)
        return this(null);

      // Then process all files
      var self = this;
      util.puts("Processing type '" + type + "'...");

      Seq.ap(expander.groupsFor(type)).
        parEach(options.concurrent, function(groupName) {
          if (options.only && !options.only.has(groupName + '.' + extensions[type])) return this(null);

          processGroup(type, groupName, this);
        }).
        seq('type', self, null);
    },

    generateCacheBoosters: function() {
      if (!options.cacheBoosters)
        this(null);

      util.puts("Writing cache boosters config file.");
      fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8', this);
    }
  };

  // Joins files from 'list' into one
  var joinFiles = function(list) {
    var content = '';
    list.forEach(function(fileName) {
      content += fs.readFileSync(fileName, 'utf-8');
    });
    return content;
  };

  // Calculates MD5 hash for cache boosters
  var cacheHash = function(data) {
    var hash = crypto.createHash('md5');
    hash.update(data.toString('utf8'));
    return hash.digest('hex');
  };

  // Dir maker
  var makeDir = function(dir) {
    var toRoot = path.relative(options.root, dir);
    var currentDir = options.root;

    toRoot.split(isWindows ? '\\' : '/').forEach(function(part) {
      currentDir = path.join(currentDir, part);
      if (!existsSync(currentDir))
        fs.mkdirSync(currentDir, 0775);
    });
  };

  // Compiles LESS files to CSS
  var compileLessToCss = function(type, callback) {
    var lessPath = options.path[type] + '/**/*';
    var filesList = expander.processList(lessPath, {
      type: 'less',
      root: options.root
    });
    util.puts("Compiling " + filesList.length + " Less file(s) to CSS...");

    Seq.ap(filesList).
      parEach(options.concurrent, function(pathToLessFile) {
        util.puts("  Compiling '" + path.basename(pathToLessFile) + "'...");

        var lessSource = fs.readFileSync(pathToLessFile, 'utf-8'),
          self = this;

        new (less.Parser)({
          paths: [path.dirname(pathToLessFile)],
          filename: pathToLessFile,
          optimizations: 1
        }).parse(lessSource, function(error, tree) {
          if (error) {
            util.puts(pathToLessFile + ": " + util.inspect(error));
            process.exit(1);
          }

          try {
            var css = tree.toCSS();
            fs.writeFile(pathToLessFile.replace('.less', '.css'), css, 'utf-8', self);
          } catch (error) {
            util.puts(pathToLessFile + ": " + util.inspect(error));
            process.exit(2);
          }
        });
      }).
      seq('less', function() {
        callback.call();
      });
  };

  // Processes group of files, outputting bundled & gzipped files
  var processGroup = function(type, group, callback) {
    var filesList = expander.processGroup(type, group, {
        type: extensions[type],
        path: options.path[type]
      });
    var groupPath = path.join(options.root, options.bundledPath[type], group + '.' + extensions[type]);
    var groupDir = path.dirname(groupPath);

    if (type == 'stylesheets') {
      Seq().
        seq(function() {
          makeDir(groupDir);
          this(null);
        }).
        seq(function() {
          var data = joinFiles(filesList);
          var cleaned = cleanCSS.process(data);
          new EnhanceCSS({
            rootPath: options.root,
            pregzip: true,
            noEmbedVersion: options.noEmbedVersion,
            assetHosts: options.assetHosts,
            cryptedStamp: options.cacheBoosters
          }).process(cleaned, this);
        }).
        par(function(data) { // plain file
          if (options.cacheBoosters) {
            var groupHash = cacheHash(data.embedded.plain);
            cacheData[type + '/' + group] = groupHash;
            groupPath = path.join(options.root, options.bundledPath[type], group) + '-' + groupHash + '.' + extensions[type];
          }

          fs.writeFile(groupPath, data.embedded.plain, 'utf-8', this);
        }).
        par(function(data) { // compressed plain file
          if (!options.gzip) return this(null);

          fs.writeFile(groupPath + '.gz', data.embedded.compressed, 'utf-8', this);
        }).
        par(function(data) { // not-embedded version
          if (!options.noEmbedVersion) return this(null);

          fs.writeFile(groupPath.replace('.' + extensions[type], '-noembed.' + extensions[type]), data.notEmbedded.plain, 'utf-8', this);
        }).
        par(function(data) { // not-embedded, gzipped version
          if (!options.gzip || !options.noEmbedVersion) return this(null);

          fs.writeFile(groupPath.replace('.' + extensions[type], '-noembed.' + extensions[type]) + '.gz', data.notEmbedded.compressed, 'utf-8', this);
        }).
        seq(function() {
          util.puts("  Processed " + type + " group '" + group + "' - squeezing " + filesList.length + " file(s)");
          this(null);
        }).
        seq('css', callback);
    } else {
      Seq().
        seq(function() {
          makeDir(groupDir);
          this(null);
        }).
        seq(function() {
          var content = joinFiles(filesList);
          var isCufon = /Cufon\.registerFont/.test(content);
          var ast = uglify.parser.parse(content);
          var data = '';
          var self = this;

          if (isCufon || options.noMinifyJS) {
            // Maybe no minification was required. We also skip mangling for Cufon as it doesn't like it.
            /* jshint camelcase:false */
            data = uglify.uglify.gen_code(ast, { beautify: true, indent_level: options.indentLevel });
          } else {
            ast = uglify.uglify.ast_mangle(ast);
            ast = uglify.uglify.ast_squeeze(ast);
            data = uglify.uglify.gen_code(ast);
            data = options.lineBreakAt ?
              uglify.uglify.split_lines(data, options.lineBreakAt) :
              data;
            /* jshint camelcase:true */
          }

          if (options.cacheBoosters) {
            var groupHash = cacheHash(data);
            cacheData[type + '/' + group] = groupHash;
            groupPath = path.join(options.root, options.bundledPath[type], group) + '-' + groupHash + '.' + extensions[type];
          }

          fs.writeFile(groupPath, data, 'utf-8', function(error) {
            if (error) throw error;

            self(null, data, groupPath);
          });
        }).
        seq(function(data, groupPath) {
          if (!options.gzip) return this(null);

          var self = this;
          zlib.gzip(data, function(error, compressedData) {
            if (error) throw error;

            fs.writeFile(groupPath + '.gz', compressedData, self);
          });
        }).
        seq(function() {
          util.puts("  Processed " + type + " group '" + group + "' - squeezing " + filesList.length + " file(s)");
          this(null);
        }).
        seq('js', callback);
    }
  };

  this.process = function() {
    Seq.ap(expander.allTypes())
      .seqEach(steps.precompileStylesheets)
      .seqEach(steps.processAssets)
      .seq(steps.generateCacheBoosters);
  };
};

module.exports = Packager;
