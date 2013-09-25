[![NPM version](https://badge.fury.io/js/assets-packager.png)](https://badge.fury.io/js/assets-packager)
[![Build Status](https://secure.travis-ci.org/GoalSmashers/assets-packager.png)](https://travis-ci.org/GoalSmashers/assets-packager)
[![Dependency Status](https://gemnasium.com/GoalSmashers/assets-packager.png)](https://gemnasium.com/GoalSmashers/assets-packager)

## What is assets-packager? ##

Assets-packager is a node.js-based tool for compiling, minifying, and packaging
CSS and JavaScript assets into production-ready packages.

CSS bundles are created from assets which are

* compiled from [LESS](https://github.com/cloudhead/less.js) templates (optional)
* minified using [clean-css](https://github.com/GoalSmashers/clean-css)
* bundled
* preprocessed via [enhance-css](https://github.com/GoalSmashers/enhance-css)
  (inline images, asset hosts, etc)
* packaged (and optionally precompressed)

And JavaScripts ones are

* bundled
* minified using the wonderful [UglifyJS](https://github.com/mishoo/UglifyJS)
* packaged (and optionally precompressed)

## Usage ##

### What are the requirements? ###

```
node 0.6.0+ on *nix (fully tested on OS X 10.6+ and CentOS)
node 0.8.0+ on Windows
```

### How to install assets-packager? ###

```
npm install -g assets-packager
```

### Tl;dr. Give me a quick demo! ###

OK. Here are commands to run

```bash
git clone git@github.com:GoalSmashers/assets-packager.git
cd assets-packager/examples
assetspkg -c assets.yml -g
```

Now check _examples/public/javascripts/bundled_ and _examples/public/stylesheets/bundled_ for bundled code.
That's it!

### Is it fast? ###

You should have just witnessed it by yourself. :-)

We use it on our production servers at [GoalSmashers.com](http://goalsmashers.com)
and it builds 20 CSS and 15 JavaScript bundles from hundreds of assets in around 15 seconds.

So yes, it is fast!

### How to use assets-packager in my application? ###

First of all it assumes you have Rails-like directory structure for your assets, e.g:

- public
    - javascripts
        - _some javascripts_
    - stylesheets
        - _some stylesheets_

Then it also needs a configuration file (here we name it assets.yml) with a definition of JS/CSS bundles, e.g:

```
# stylesheets
stylesheets:
  application: 'reset,grid,base,application'
# javascripts
javascripts:
  application:
    - 'vendor/jquery'
    - 'application,helpers'
```

We recommend placing it somewhere else than in your _public_ folder (could be _config_ in case of Rails).

Now you can bundle all these packages with a single command:

```
assetspkg -c assets.yml
```

All the packages go into _public/javascripts/bundled_ and _public/stylesheets/bundled_.
You'll probably want to put that command somewhere into your build/deploy script.

### How to configure it? ###

```
assetspkg -h
```

Options include:

* -c - path to file with bundles definition (defaults to ./config/assets.yml)
* -r - root directory with assets directories (defaults to ./public)
* -g - create gzipped bundles (useful if your server supports serving precompressed files, like [nginx](http://wiki.nginx.org/NginxHttpGzipStaticModule))
* --nm - do not minify JS, only combine (use the `beautify` option of UglifyJS)
* -i - when using --nm, specify the indentation level in spaces
* -j - number of concurrent tasks executed at once (defaults to number of logical CPUs)
* -n - create alternate stylesheets bundles without inlined images (Explorer 6/7, I'm looking at you!)
* -a - use asset hosts for image URLs, e.g _-a [assets0,assets1].yourdomain.com_
* -b - add MD5 hash to bundled file names (aka hard cache boosters)
* -o - narrow the set of bundles being build, e.g. _-o application.js_, _-o *.css_, or _-o public.css,application.css_

### The feature I want is not there! ###

Open an issue. Or better: fork the project, add the feature
(don't forget about tests!) and send a pull request.

### How to test assets-packager? ###

First, install dependencies

```
npm install
```

Then, run the specs:

```
npm test
```

## Contributors ##

* Jean-Denis Vauguet [@chikamichi](https://github.com/chikamichi) - `--nominifyjs` and `--indent` options allow for combination-only processing.

## License ##

Assets-packager is released under the [MIT License](https://github.com/GoalSmashers/assets-packager/blob/master/LICENSE).
