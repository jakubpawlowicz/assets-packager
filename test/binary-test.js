var vows = require('vows'),
  assert = require('assert'),
  fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec;

var withOptions = function(options) {
  return function() {
    exec("cd test; ../bin/assetspkg " + (options || ''), this.callback);
  };
};

var fullPath = function(suffix) {
  return path.join(process.cwd(), suffix);
};

exports.commandsSuite = vows.describe('binary commands').addBatch({
  'no options': {
    topic: withOptions(),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should not produce output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should not give empty error': function(error, stdout, stderr) {
      assert.isNotNull(stderr);
    },
    'should not give empty error': function(error, stdout, stderr) {
      assert.include(stderr, 'is missing');
    }
  },
  'help option': {
    topic: withOptions('-h'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should give help': function(error, stdout) {
      assert.include(stdout, 'usage:')
      assert.include(stdout, 'options:')
    }
  },
  'help option via --help': {
    topic: withOptions('--help'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should give help': function(error, stdout) {
      assert.include(stdout, 'usage:')
      assert.include(stdout, 'options:')
    }
  },
  'non existing root path': {
    topic: withOptions('-r test/fake -c data/empty.yml'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should not give output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should print not found error': function(error, stdout, stderr) {
      assert.include(stderr, 'test/fake" could not be found');
    }
  },
  'non existing config file': {
    topic: withOptions('-r test/fake -c data/fake.yml'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should not give output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should print not found error': function(error, stdout, stderr) {
      assert.include(stderr, 'data/fake.yml" is missing');
    }
  },
  'version': {
    topic: withOptions('-v'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should give proper version': function(error, stdout) {
      var version = JSON.parse(fs.readFileSync('./package.json')).version;
      assert.include(stdout, version);
    }
  }
});

exports.packagingSuite = vows.describe('packaging all').addBatch({
  'packaging without gzipped version': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/one.css')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/two.css')));
    },
    'should bundle css into packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/subset.css')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/all.css')));
    },
    'should bundle css into compressed packages': function() {
      assert.isFalse(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/subset.css.gz')));
      assert.isFalse(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/all.css.gz')));
    },
    'should bundle js into packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/subset.js')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/all.js')));
    },
    'should bundle js into compressed packages': function() {
      assert.isFalse(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/subset.js.gz')));
      assert.isFalse(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/all.js.gz')));
    },
    teardown: function() {
      exec('rm -rf ' + fullPath('test/data/test1/public/javascripts/bundled'));
      exec('rm -rf ' + fullPath('test/data/test1/public/stylesheets/bundled'));
      exec('rm -rf ' + fullPath('test/data/test1/public/stylesheets/*.css'));
    }
  }
}).addBatch({
  'packaging with gzipped version': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/one.css')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/two.css')));
    },
    'should bundle css into packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/subset.css')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/all.css')));
    },
    'should bundle css into compressed packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/subset.css.gz')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/stylesheets/bundled/all.css.gz')));
    },
    'should bundle js into packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/subset.js')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/all.js')));
    },
    'should bundle js into compressed packages': function() {
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/subset.js.gz')));
      assert.isTrue(path.existsSync(fullPath('test/data/test1/public/javascripts/bundled/all.js.gz')));
    },
    teardown: function() {
      exec('rm -rf ' + fullPath('test/data/test1/public/javascripts/bundled'));
      exec('rm -rf ' + fullPath('test/data/test1/public/stylesheets/bundled'));
      exec('rm -rf ' + fullPath('test/data/test1/public/stylesheets/*.css'));
    }
  }
});