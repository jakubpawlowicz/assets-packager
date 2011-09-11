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