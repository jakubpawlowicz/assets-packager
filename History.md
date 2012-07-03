0.5.0 / 2012-07-03
==================

  * Added hard cache boosters option (-b) for creating files with MD5 hash in name.
  * Added cached file (if config is assets.yml then it's named .assets.yml.json) with MD5 hashes for current stamps.
  * Added test for cache boosters
  * Updated enhance-css to 0.3.x.
  * Updated clean-css to 0.4.x and optimist to 0.3.x.

0.4.2 / 2012-06-04
==================

  * Renamed sys node package to util (thanks @heldr)
  * Fixed one spec due to change in uglify-js.

0.4.1 / 2011-12-21
==================

  * Added throttling to less compilation so it does not eat too many processes at once.

0.4.0 / 2011-11-21
==================

  * Added pull request by @chikamichi with --nominifyjs and --indent options.

0.3.2 / 2011-09-12
==================

  * Fixed processing font definition (Cufon) files (no optimizations there).
  * Increased number of characters per line to ~ 80 in optimized JS files.
  * Fixed '-v' switch in NPM 1.x.

0.3.1 / 2011-09-11
==================

  * Only (-o) option accepts wildcard options, e.g (*.js)
  * JavaScript optimization does not output beautified code anymore but minimized one with breaks after ~ 40 characters.

0.3.0 / 2011-04-17
==================

  * Added ability to specify asset hosts via -a parameter.
  * Added skipping LESS processing when packaging JS files only.

0.2.0 / 2011-04-17
==================

  * Added option to package only a subset of bundles.
  * Added option to gzip bundles.
  * Added option to produce non-embedded version of CSS bundles.
  * Added binary tests.
  * Added Makefile.

0.1.1 / 2011-04-15
==================

  * Added skipping JS mangling & squeezing for Cufon fonts.

0.1.0 / 2011-04-15
==================

  * First experimental version of assets-packager utility.
  * Implemented packaging CSS (via LESS compiler) and JavaScript files into bundled (and pre-gzipped) versions.