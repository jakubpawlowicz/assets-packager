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

var cleanBundles = function(set) {
  exec('rm -rf ' + fullPath('test/data/' + set + '/public/javascripts/bundled'));
  exec('rm -rf ' + fullPath('test/data/' + set + '/public/stylesheets/bundled'));
  exec('rm -rf ' + fullPath('test/data/' + set + '/public/stylesheets/*.css'));
};

assert.hasFile = function(set, type, name) {
  assert.isTrue(path.existsSync(fullPath(path.join('test/data', set, 'public', type, name))));
};
assert.notHasFile = function(set, type, name) {
  assert.isFalse(path.existsSync(fullPath(path.join('test/data', set, 'public', type, name))));
};
assert.hasBundledFile = function(set, type, name) {
  assert.isTrue(path.existsSync(fullPath(path.join('test/data', set, 'public', type, 'bundled', name))));
};
assert.notHasBundledFile = function(set, type, name) {
  assert.isFalse(path.existsSync(fullPath(path.join('test/data', set, 'public', type, 'bundled', name))));
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
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should not bundle css into compressed packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should not bundle css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging with gzipped version': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should not bundle css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should bundle js into compressed packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging with gzipped and "no embed" versions': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should bundle js into compressed packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
});

exports.Suite = vows.describe('packaging all').addBatch({
  'packaging only one selected package': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging only two selected packages': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css,subset.css'),
    'should not give error': function(error, stdout, stderr) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging only three selected packages': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css,subset.css,all.js'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not compiling less when packaging js packages only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.js'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should not compile css to less': function() {
      assert.notHasFile('test1', 'stylesheets', 'one.css');
      assert.notHasFile('test1', 'stylesheets', 'two.css');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'compiling all javascripts': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -o \\*.js'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should not compile css to less': function() {
      assert.notHasFile('test1', 'stylesheets', 'one.css');
      assert.notHasFile('test1', 'stylesheets', 'two.css');
    },
    'should not bundle selected css into packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.notHasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should package all js files': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js')
      assert.hasBundledFile('test1', 'javascripts', 'all.js')
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'compiling all stylesheets': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -o \\*.css'),
    'should not give error': function(error, stdout) {
      assert.isNull(error);
    },
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should package all js files': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js')
      assert.notHasBundledFile('test1', 'javascripts', 'all.js')
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not showing processing JS when packaging CSS only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css'),
    'should not output processing JS': function(error, stdout) {
      assert.equal(-1, stdout.indexOf("Processing type 'javascripts'"));
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not showing processing CSS when packaging JS only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.js'),
    'should not output processing CSS': function(error, stdout) {
      assert.equal(-1, stdout.indexOf("Processing type 'stylesheets'"));
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
});

exports.javascriptOptimizing = vows.describe('javascript optimizing').addBatch({
  'correct optimization': {
    topic: withOptions('-r data/test3/public -c data/test3/assets.yml'),
    'for optimizations.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/optimizations.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error) throw error;

        assert.equal(["function factorial(a){return a==0?1:a*factorial(a-1)}for(var i=0,j=factorial(10).", "toString(),k=j.length;i<k;i++)console.log(j[i])"].join('\n'),
          data);
      }
    },
    'for cufon.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/fonts.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error) throw error;

        assert.equal("Cufon.registerFont(function(f) {\nvar b = _cufon_bridge_ = {\np: [ {\nd: \"88,-231v18,-2,31,19,8,26v-86,25,-72,188,-18,233v7,4,17,4,17,13v-1,14,-12,18,-26,10v-19,-10,-48,-49,-56,-77\"\n} ]\n};\n});",
          data)
      }
    },
    teardown: function() {
      cleanBundles('test3');
    }
  }
}).addBatch({
  'no JS minification': {
    topic: withOptions('-r data/test3/public --nm -i 2 -c data/test3/assets.yml'),
    'for optimizations.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/optimizations.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error) throw error;

        assert.equal(data, "function factorial(n) {\n  if (n == 0) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}\n\nfor (var i = 0, j = factorial(10).toString(), k = j.length; i < k; i++) {\n  console.log(j[i]);\n}");
      }
    },
    teardown: function() {
      cleanBundles('test3');
    }
  }
});

exports.assetsHosts = vows.describe('assets hosts').addBatch({
  'no asset hosts': {
    topic: withOptions('-r data/test2/public -c data/test2/assets.yml'),
    'in plain file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should not add assets hosts': function(error, data) {
        assert.include(data, "url(/images/one.png");
        assert.include(data, "url(/images/two.png");
      }
    },
    teardown: function() {
      cleanBundles('test2');
    }
  }
}).addBatch({
  'asset hosts': {
    topic: withOptions('-r data/test2/public -c data/test2/assets.yml -n -a assets[0,1].example.com'),
    'in plain file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should add assets hosts': function(error, data) {
        assert.include(data, "url(//assets0.example.com/images/one.png");
        assert.include(data, "url(//assets1.example.com/images/two.png");
      }
    },
    'in noembed file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all-noembed.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should add assets hosts': function(error, data) {
        assert.include(data, "url(//assets0.example.com/images/one.png");
        assert.include(data, "url(//assets1.example.com/images/two.png");
      }
    },
    teardown: function() {
      cleanBundles('test2');
    }
  }
});
