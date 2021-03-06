#!/usr/bin/env node

var program = require('commander');
var glob = require('glob');
var linter = require('./linter.js');
var rules = require('./rules.js');
var fs = require('fs');

var defaultConfigFileName = '.gherkin-lintrc';
var defaultIgnoreFileName = '.gherkin-lintignore';

function list(val) {
  return val.split(',');
}

program
  .option('-f, --format [format]', 'Output format. Defaults to stylish')
  .option('-i, --ignore <...>', 'Comma seperated list of files/glob patterns that the linter should ignore. Overrides ' + defaultIgnoreFileName + ' file', list)
  .option('-c, --config [config]', 'Configuration file. Defaults to ' + defaultConfigFileName)
  .parse(process.argv);

var files = getFeatureFiles(program.args, program.ignore);
var config = getConfiguration(program.config);
var results = linter.lint(files, config);
printResults(results, program.format);
process.exit(getExitCode(results));

function getExitCode(results) {
  var exitCode = 0;
  results.forEach(function(result) {
    if (result.errors.length > 0) {
      exitCode = 1;
    }
  });
  return exitCode;
}

function printResults(results, format) {
  var formatter;
  if (format === 'json') {
    formatter = require('./formatters/json.js');
  } else if (!format || format == 'stylish') {
    formatter = require('./formatters/stylish.js');
  } else {
    throw new Error('Unsupported format. The supported formats are json and stylish.');
  }
  formatter.printResults(results);
}

function getConfiguration(configPath) {
  if (configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error('Could not find specified config file "' + configPath + '"');
    }
  } else {
    if (!fs.existsSync(defaultConfigFileName)) {
      throw new Error('Could not find default config file "' + defaultConfigFileName +'" in the working ' +
                      'directory. To use a custom name/location provide the config file using the "-c" arg.');
    }
    configPath = defaultConfigFileName;
  }
  var config = JSON.parse(fs.readFileSync(configPath));
  verifyConfigurationFile(config);
  return config;
}

function verifyConfigurationFile(config) {
  for (var rule in config) {
    if (!rules.doesRuleExist(rule)) {
      throw new Error('Rule "' + rule + '" does not exist');
    }
    rules.verifyRuleConfiguration(rule, config[rule]);
  }
}

function getIgnorePatterns(ignoreArg) {
  if (ignoreArg) {
    return ignoreArg;
  } else if (fs.existsSync(defaultIgnoreFileName)) {
    // return an array where each element of the array is a line of the ignore file
    return fs.readFileSync(defaultIgnoreFileName)
              .toString()
              .split(/[\n|\r]/)
              .filter(function(i) {
              // remove empty strings
                if (i !== '') {
                  return true;
                }
                return false;
              });
  } else {
    // Ignore node_modules by default
    return 'node_modules/**';
  }
}

function getFeatureFiles(args, ignoreArg) {
  var files = [];
  args.forEach(function(arg) {
    var pattern = '';
    if (arg == '.') {
      pattern = '**/*.feature';
    } else if (arg.match(/.*\/\*\*/)) {
      pattern = arg.slice(0, -1) + '.feature';
    } else if(arg.match(/\/$/)) {
      pattern = arg + '**/*.feature';
    } else if (arg.match(/.*\.feature/)) {
      pattern = arg;
    } else {
      throw new Error('Invalid input format. To run the linter please specify a feature file, directory or glob.');
    }

    var globOptions = {ignore: getIgnorePatterns(ignoreArg)};
    files = files.concat(glob.sync(pattern, globOptions));
  });
  return files;
}
