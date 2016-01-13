'use strict';

/**
 * The `kss/generator` module loads the {@link KssGenerator} class constructor.
 * ```
 * const KssGenerator = require('kss/generator');
 * ```
 * @module kss/generator
 */

/* **************************************************************
   See kss_example_generator.js for how to implement a generator.
   ************************************************************** */

const Kss = require('../lib/kss.js'),
  wrench = require('wrench');

class KssGenerator {
  /**
   * Create a KssGenerator object.
   *
   * This is the base object used by all kss-node generators. Implementations of
   * KssGenerator MUST pass the version parameter. kss-node will use this to
   * ensure that only compatible generators are used.
   *
   * ```
   * const KssGenerator = require('kss/generator');
   * const customGenerator = new KssGenerator('2.1');
   * ```
   *
   * @constructor
   * @alias KssGenerator
   * @param {string} version The generator API version implemented.
   * @param {object} options The Yargs-like options this generator has.
   *   See https://github.com/bcoe/yargs/blob/master/README.md#optionskey-opt
   */
  constructor(version, options) {
    if (!(this instanceof KssGenerator)) {
      return new KssGenerator();
    }

    // Tell generators which generator API version is currently running.
    this.API = '2.1';

    // Store the version of the generator API that the generator instance is
    // expecting; we will verify this in checkGenerator().
    this.implementsAPI = typeof version === 'undefined' ? 'undefined' : version;

    // Tell kss-node which Yargs-like options this generator has.
    this.options = options || {};

    // The log function defaults to console.log.
    this.setLogFunction(console.log);
  }

  /**
   * Logs a message to be reported to the user.
   *
   * Since a generator can be used in places other than the console, using
   * console.log() is inappropriate. The log() method should be used to pass
   * messages to the KSS system so it can report them to the user.
   *
   * @param {string} message The message to log.
   */
  log() {
    this.logFunction.apply(null, arguments);
  }

  /**
   * The log() method logs a message for the user. This method allows the system
   * to define the underlying function used by the log method to report the
   * message to the user. The default log function is a wrapper around
   * console.log().
   *
   * @param {Function} logFunction Function to log a message to the user.
   */
  setLogFunction(logFunction) {
    this.logFunction = logFunction;
  }

  /**
   * Checks the generator configuration.
   *
   * An instance of KssGenerator MUST NOT override this method. A process
   * controlling the generator should call this method to verify the
   * specified generator has been configured correctly.
   *
   * @alias KssGenerator.prototype.checkGenerator
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs.
   * @returns {*} The callback's return value.
   */
  checkGenerator(cb) {
    let isCompatible = true,
      version,
      apiMajor,
      apiMinor,
      thisMajor,
      thisMinor;

    if (!(this instanceof KssGenerator)) {
      return cb(new Error('The loaded generator is not a KssGenerator object.'));
    }

    if (this.implementsAPI === 'undefined') {
      isCompatible = false;
    } else {
      version = this.API.split('.');
      apiMajor = parseInt(version[0]);
      apiMinor = parseInt(version[1]);

      version = this.implementsAPI.split('.');
      thisMajor = parseInt(version[0]);
      thisMinor = parseInt(version[1]);

      if (thisMajor !== apiMajor || thisMinor > apiMinor) {
        isCompatible = false;
      }
    }

    if (!isCompatible) {
      return cb(new Error('kss-node expected the template\'s generator to implement KssGenerator API version ' + this.API + '; version "' + this.implementsAPI + '" is being used instead.'));
    }

    return cb(null);
  }

  /**
   * Clone a template's files.
   *
   * This method is fairly simple; it copies one directory to the specified
   * location. An instance of KssGenerator does not need to override this method,
   * but it can if it needs to do something more complicated.
   *
   * @alias KssGenerator.prototype.clone
   * @param {string} templatePath    Path to the template to clone.
   * @param {string} destinationPath Path to the destination of the newly cloned
   *                                 template.
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs.
   * @returns {*} The callback's return value.
   */
  clone(templatePath, destinationPath, cb) {
    return wrench.copyDirRecursive(
      templatePath,
      destinationPath,
      {
        forceDelete: false,
        excludeHiddenUnix: true
      },
      function(error) {
        if (error) {
          // istanbul ignore else
          if (error.message === 'You are trying to delete a directory that already exists. Specify forceDelete in an options object to override this.') {
            error = new Error('This folder already exists: ' + destinationPath);
          }
          return cb(error);
        }
        return cb(null);
      }
    );
  }

  /**
   * Initialize the style guide creation process.
   *
   * This method is given a configuration JSON object with the details of the
   * requested style guide generation. The generator can use this information for
   * any necessary tasks before the KSS parsing of the source files.
   *
   * @alias KssGenerator.prototype.init
   * @param {Object} config Configuration object for the requested generation.
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs.
   * @returns {*} The callback's return value.
   */
  init(config, cb) {
    // At the very least, generators MUST save the configuration parameters.
    this.config = config;

    return cb(null);
  }

  /**
   * Parse the source files for KSS comments and create a KssStyleGuide object.
   *
   * When finished, it passes the completed KssStyleGuide to the given callback.
   *
   * @alias KssGenerator.prototype.parse
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs, and a fully-populated
   *                      KssStyleGuide as its second parameter.
   * @returns {*} The callback's return value.
   */
  parse(cb) {
    if (this.config.verbose) {
      this.log('...Parsing your style guide:');
    }

    // The default parse() method looks at the paths to the source folders and
    // uses KSS' traverse method to load, read and parse the source files. Other
    // generators may want to use KSS' parse method if they have already loaded
    // the source files through some other mechanism.
    return Kss.traverse(this.config.source, {
      header: true,
      markdown: true,
      markup: true,
      mask: this.config.mask,
      custom: this.config.custom
    }, cb);
  }

  /**
   * Allow the template to prepare itself or modify the KssStyleGuide object.
   *
   * @alias KssGenerator.prototype.prepare
   * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs, and a fully-populated
   *                      KssStyleGuide as its second parameter.
   * @returns {*} The callback's return value.
   */
  prepare(styleGuide, cb) {
    return cb(null, styleGuide);
  }

  /**
   * Generate the HTML files of the style guide given a KssStyleGuide object.
   *
   * @alias KssGenerator.prototype.generate
   * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
   * @param {Function} cb Callback that will be given an Error as its first
   *                      parameter, if one occurs.
   * @returns {*} The callback's return value.
   */
  generate(styleGuide, cb) {
    return cb(null);
  }
}

module.exports = KssGenerator;
