[![NPM version](https://badge.fury.io/js/assets-packager.png)](https://badge.fury.io/js/assets-packager)
[![Build Status](https://secure.travis-ci.org/jakubpawlowicz/assets-packager.png)](https://travis-ci.org/jakubpawlowicz/assets-packager)
[![Dependency Status](https://david-dm.org/jakubpawlowicz/assets-packager.png?theme=shields.io)](https://david-dm.org/jakubpawlowicz/assets-packager)
[![devDependency Status](https://david-dm.org/jakubpawlowicz/assets-packager/dev-status.png?theme=shields.io)](https://david-dm.org/jakubpawlowicz/assets-packager#info=devDependencies)

## What is assets-packager?

Assets-packager is a tool for compiling, minifying, and packaging CSS and JavaScript assets into production-ready packages.

CSS bundles are created from assets which are:

* compiled from [LESS](https://github.com/less/less.js) templates (optional),
* minified using [clean-css](https://github.com/jakubpawlowicz/clean-css),
* bundled,
* preprocessed via [enhance-css](https://github.com/jakubpawlowicz/enhance-css)
  (inline images, asset hosts, etc),
* and packaged (and optionally precompressed).

Similarly JavaScript files are:

* bundled,
* minified using [UglifyJS](https://github.com/mishoo/UglifyJS),
* and packaged (and optionally precompressed)


## Usage

### What are the requirements?

```
node.js 0.8.0+ on *nix (fully tested on OS X 10.6+ and CentOS) and Windows
```

### How to install assets-packager?

```
npm install -g assets-packager
```

### Tl;dr. Give me a quick demo!

OK. Here are commands to run

```bash
git clone git@github.com:jakubpawlowicz/assets-packager.git
cd assets-packager/examples
assetspkg -c assets.yml -g
```

Now check _examples/public/javascripts/bundled_ and _examples/public/stylesheets/bundled_ for bundled code.
That's it!

### Is it fast?

You should have just witnessed it by yourself. :-)

It is used as a part of build process for [GoalSmashers.com](http://goalsmashers.com)
and it takes around 10 seconds to buld 40 CSS and 20 JavaScript bundles from hundreds of assets.

So yes, it is fast!

### How to use assets-packager in my application?

First of all it assumes Rails-like directory structure for your assets, e.g:

- public
    - javascripts
        - _some scripts_
    - stylesheets
        - _some styles_

Then it needs a configuration file (here we name it **assets.yml**)
with a definition of JS/CSS bundles, e.g:

```yml
stylesheets:
  application: 'reset,grid,base,application'
javascripts:
  application:
    - 'vendor/jquery'
    - 'application,helpers'
```

We recommend placing it somewhere else than in your _public_ folder.

Now you can bundle all these packages with a single command:

```
assetspkg -c assets.yml
```

All the packages go into _public/javascripts/bundled_ and _public/stylesheets/bundled_.

### How to use assets-packager CLI?

Assets-packager accepts the following command line arguments:

```
assetspkg [options]

-h, --help                  output usage information
-v, --version               output the version number
-b, --cache-boosters        add MD5 hash to file names aka hard cache boosters
-c, --config [path]         path to file with bundles definition (defaults to ./config/assets.yml)
--css-asset-hosts [list]    assets host prefix URLs with in CSS bundles
--css-bundle-to [path]      path to stylesheets root directory (relative to --root option)
--css-embed-all             forces embedding of all resources by enhance-css
--css-safe-embed            create an additional version of packaged CSS without embedded images
--css-source [path]         path to stylesheets root directory (relative to --root option)
-g, --gzip                  gzip packaged files
-j, --concurrent [value]    number of concurrent tasks executed at once (defaults to number of logical CPUs)
--js-bundle-to [path]       path to JavaScript root directory (relative to --root option)
--js-indent [value]         indentation level in spaces when used with --js-no-minify switch
--js-line-break-at [value]  number of characters per line in optimized JavaScript (defaults to no limit)
--js-no-minify              turn off JS minification
--js-source [path]          path to JavaScript root directory (relative to --root option)
-o, --only [list]           package only given assets group or groups if separated by comma(s)
-r, --root [path]           root directory with assets directories (defaults to ./public)
```

### What are the assets-packager's dev commands?

First clone the source, then run:

* `npm run check` to check JS sources with [JSHint](https://github.com/jshint/jshint/)
* `npm test` for the test suite

### The feature I want is not there!

Open an issue. Or better: fork the project, add the feature
(don't forget about tests!) and send a pull request.


## Contributors

* Jean-Denis Vauguet [@chikamichi](https://github.com/chikamichi) - `--nominifyjs` and `--indent` options allow for combination-only processing.


## License

Assets-packager is released under the [MIT License](https://github.com/jakubpawlowicz/assets-packager/blob/master/LICENSE).
