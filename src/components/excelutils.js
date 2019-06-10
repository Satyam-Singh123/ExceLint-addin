"use strict";
// excel-utils
exports.__esModule = true;
var sjcl = require("sjcl");
var rectangleutils_js_1 = require("./rectangleutils.js");
var ExcelUtils = /** @class */ (function () {
    function ExcelUtils() {
    }
    // Convert the UID string into a hashed version using SHA256, truncated to a max length.
    ExcelUtils.hash_sheet = function (uid, maxlen) {
        if (maxlen === void 0) { maxlen = 31; }
        // We can't just use the UID because it is too long to be a sheet name in Excel (limit is 31 characters).
        return (sjcl.codec.base32.fromBits(sjcl.hash.sha256.hash(uid)).slice(0, maxlen));
    };
    ExcelUtils.get_rectangle = function (proposed_fixes, current_fix) {
        if (!proposed_fixes) {
            return null;
        }
        if (proposed_fixes.length > 0) {
            // console.log("proposed_fixes = " + JSON.stringify(proposed_fixes));
            // console.log("current fix = " + current_fix);
            var r = rectangleutils_js_1.RectangleUtils.bounding_box(proposed_fixes[current_fix][1], proposed_fixes[current_fix][2]);
            // console.log("r = " + JSON.stringify(r));
            // convert to sheet notation
            var col0 = ExcelUtils.column_index_to_name(r[0][0]);
            var row0 = r[0][1].toString();
            var col1 = ExcelUtils.column_index_to_name(r[1][0]);
            var row1 = r[1][1].toString();
            return [col0, row0, col1, row1];
        }
        else {
            return null;
        }
    };
    // Convert an Excel column name (a string of alphabetical charcaters) into a number.
    ExcelUtils.column_name_to_index = function (name) {
        if (name.length === 1) { // optimizing for the overwhelmingly common case
            return name[0].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        }
        var value = 0;
        var split_name = name.split('');
        for (var _i = 0, split_name_1 = split_name; _i < split_name_1.length; _i++) {
            var i = split_name_1[_i];
            value *= 26;
            value += (i.charCodeAt(0) - 'A'.charCodeAt(0)) + 1;
        }
        return value;
    };
    // Convert a column number to a name (as in, 3 => 'C').
    ExcelUtils.column_index_to_name = function (index) {
        var str = '';
        while (index > 0) {
            str += String.fromCharCode((index - 1) % 26 + 65); // 65 = 'A'
            index = Math.floor((index - 1) / 26);
        }
        return str.split('').reverse().join('');
    };
    // Returns a vector (x, y) corresponding to the column and row of the computed dependency.
    ExcelUtils.cell_dependency = function (cell, origin_col, origin_row) {
        {
            var r = ExcelUtils.cell_both_absolute.exec(cell);
            if (r) {
                //console.log('both_absolute');
                var col = ExcelUtils.column_name_to_index(r[1]);
                var row = Number(r[2]);
                //console.log("parsed " + JSON.stringify([col, row]));
                return [col, row];
            }
        }
        {
            var r = ExcelUtils.cell_col_absolute.exec(cell);
            if (r) {
                //console.log("cell col absolute only " + JSON.stringify(r));
                var col = ExcelUtils.column_name_to_index(r[1]);
                var row = Number(r[2]);
                //	    console.log('absolute col: ' + col + ', row: ' + row);
                return [col, row - origin_row];
            }
        }
        {
            var r = ExcelUtils.cell_row_absolute.exec(cell);
            if (r) {
                //console.log('row_absolute');
                var col = ExcelUtils.column_name_to_index(r[1]);
                var row = Number(r[2]);
                return [col - origin_col, row];
            }
        }
        {
            var r = ExcelUtils.cell_both_relative.exec(cell);
            if (r) {
                //console.log('both_relative: r[1] = ' + r[1] + ', r[2] = ' + r[2]);
                var col = ExcelUtils.column_name_to_index(r[1]);
                var row = Number(r[2]);
                //		console.log('both relative col: ' + col + ', row: ' + row);
                return [col - origin_col, row - origin_row];
            }
        }
        throw new Error('We should never get here.');
        return [0, 0];
    };
    ExcelUtils.extract_sheet_cell = function (str) {
        var matched = ExcelUtils.sheet_plus_cell.exec(str);
        if (matched) {
            return [matched[1], matched[2], matched[3]];
        }
        return ['', '', ''];
    };
    ExcelUtils.extract_sheet_range = function (str) {
        var matched = ExcelUtils.sheet_plus_range.exec(str);
        if (matched) {
            return [matched[1], matched[2], matched[3]];
        }
        return ['', '', ''];
    };
    ExcelUtils.all_cell_dependencies = function (range) {
        //	console.log("looking for dependencies in " + range);
        var found_pair = null;
        var all_vectors = [];
        if (typeof (range) !== 'string') {
            return null;
        }
        range = range.replace(this.formulas_with_numbers, '_'); // kind of a hack for now
        range = range.replace(this.formulas_with_sheetnames, '_'); // kind of a hack for now
        /// FIX ME - should we count the same range multiple times? Or just once?
        // First, get all the range pairs out.
        while (found_pair = ExcelUtils.range_pair.exec(range)) {
            if (found_pair) {
                //		console.log('all_cell_dependencies --> ' + found_pair);
                var first_cell = found_pair[1];
                //		console.log(' first_cell = ' + first_cell);
                var first_vec = ExcelUtils.cell_dependency(first_cell, 0, 0);
                //		console.log(' first_vec = ' + JSON.stringify(first_vec));
                var last_cell = found_pair[2];
                //		console.log(' last_cell = ' + last_cell);
                var last_vec = ExcelUtils.cell_dependency(last_cell, 0, 0);
                //		console.log(' last_vec = ' + JSON.stringify(last_vec));
                // First_vec is the upper-left hand side of a rectangle.
                // Last_vec is the lower-right hand side of a rectangle.
                // Generate all vectors.
                var length_1 = last_vec[0] - first_vec[0] + 1;
                var width = last_vec[1] - first_vec[1] + 1;
                for (var x = 0; x < length_1; x++) {
                    for (var y = 0; y < width; y++) {
                        // console.log(' pushing ' + (x + first_vec[0]) + ', ' + (y + first_vec[1]));
                        // console.log(' (x = ' + x + ', y = ' + y);
                        all_vectors.push([x + first_vec[0], y + first_vec[1]]);
                    }
                }
                // Wipe out the matched contents of range.
                range = range.replace(found_pair[0], '_');
            }
        }
        // Now look for singletons.
        var singleton = null;
        while (singleton = ExcelUtils.single_dep.exec(range)) {
            if (singleton) {
                //		console.log('SINGLETON');
                //		console.log('singleton[1] = ' + singleton[1]);
                //	    console.log(found_pair);
                var first_cell = singleton[1];
                //                console.log(first_cell);
                var vec = ExcelUtils.cell_dependency(first_cell, 0, 0);
                all_vectors.push(vec);
                // Wipe out the matched contents of range.
                range = range.replace(singleton[0], '_');
            }
        }
        //console.log(JSON.stringify(all_vectors));
        return all_vectors;
    };
    ExcelUtils.dependencies = function (range, origin_col, origin_row) {
        var base_vector = [0, 0];
        var found_pair = null;
        range = range.replace(this.formulas_with_numbers, '_'); // kind of a hack for now
        range = range.replace(this.formulas_with_sheetnames, '_'); // kind of a hack for now
        /// FIX ME - should we count the same range multiple times? Or just once?
        // First, get all the range pairs out.
        while (found_pair = ExcelUtils.range_pair.exec(range)) {
            if (found_pair) {
                //	    console.log(found_pair);
                var first_cell = found_pair[1];
                //		console.log(first_cell);
                var first_vec = ExcelUtils.cell_dependency(first_cell, origin_col, origin_row);
                var last_cell = found_pair[2];
                //		console.log(last_cell);
                var last_vec = ExcelUtils.cell_dependency(last_cell, origin_col, origin_row);
                // First_vec is the upper-left hand side of a rectangle.
                // Last_vec is the lower-right hand side of a rectangle.
                // Compute the appropriate vectors to be added.
                // e.g., [3, 2] --> [5, 5] ===
                //          [3, 2], [3, 3], [3, 4], [3, 5]
                //          [4, 2], [4, 3], [4, 4], [4, 5]
                //          [5, 2], [5, 3], [5, 4], [5, 5]
                //
                // vector to be added is [4 * (3 + 4 + 5), 3 * (2 + 3 + 4 + 5) ]
                //  = [48, 42]
                var sum_x = 0;
                var sum_y = 0;
                var width = last_vec[1] - first_vec[1] + 1; // 4
                sum_x = width * ((last_vec[0] * (last_vec[0] + 1)) / 2 - ((first_vec[0] - 1) * ((first_vec[0] - 1) + 1)) / 2);
                var length_2 = last_vec[0] - first_vec[0] + 1; // 3
                sum_y = length_2 * ((last_vec[1] * (last_vec[1] + 1)) / 2 - ((first_vec[1] - 1) * ((first_vec[1] - 1) + 1)) / 2);
                base_vector[0] += sum_x;
                base_vector[1] += sum_y;
                // Wipe out the matched contents of range.
                range = range.replace(found_pair[0], '_');
            }
        }
        // Now look for singletons.
        var singleton = null;
        while (singleton = ExcelUtils.single_dep.exec(range)) {
            if (singleton) {
                //	    console.log(found_pair);
                var first_cell = singleton[1];
                //                console.log("dependencies: first cell = " + JSON.stringify(first_cell) + ", origin col = " + origin_col + ", origin_row = " + origin_row);
                var vec = ExcelUtils.cell_dependency(first_cell, origin_col, origin_row);
                //		console.log("dependencies: vec = " + vec[0] + ", " + vec[1]);
                base_vector[0] += vec[0];
                base_vector[1] += vec[1];
                // Wipe out the matched contents of range.
                range = range.replace(singleton[0], '_');
            }
        }
        return base_vector;
    };
    // Matchers for all kinds of Excel expressions.
    ExcelUtils.general_re = '\\$?[A-Z][A-Z]?\\$?\\d+'; // column and row number, optionally with $
    ExcelUtils.sheet_re = '[^\\!]+';
    ExcelUtils.sheet_plus_cell = new RegExp('(' + ExcelUtils.sheet_re + ')\\!(' + ExcelUtils.general_re + ')');
    ExcelUtils.sheet_plus_range = new RegExp('(' + ExcelUtils.sheet_re + ')\\!(' + ExcelUtils.general_re + '):(' + ExcelUtils.general_re + ')');
    ExcelUtils.single_dep = new RegExp('(' + ExcelUtils.general_re + ')');
    ExcelUtils.range_pair = new RegExp('(' + ExcelUtils.general_re + '):(' + ExcelUtils.general_re + ')', 'g');
    ExcelUtils.cell_both_relative = new RegExp('[^\\$A-Z]?([A-Z][A-Z]?)(\\d+)');
    ExcelUtils.cell_col_absolute = new RegExp('\\$([A-Z][A-Z]?)[^\\$\\d]?(\\d+)');
    ExcelUtils.cell_row_absolute = new RegExp('[^\\$A-Z]?([A-Z][A-Z]?)\\$(\\d+)');
    ExcelUtils.cell_both_absolute = new RegExp('\\$([A-Z][A-Z]?)\\$(\\d+)');
    // We need to filter out all formulas with numbers so they don't mess with our dependency regexps.
    ExcelUtils.formulas_with_numbers = new RegExp('/ATAN2|BIN2DEC|BIN2HEX|BIN2OCT|DAYS360|DEC2BIN|DEC2HEX|DEC2OCT|HEX2BIN|HEX2DEC|HEX2OCT|IMLOG2|IMLOG10|LOG10|OCT2BIN|OCT2DEC|OCT2HEX|SUNX2MY2|SUMX2PY2|SUMXMY2|T.DIST.2T|T.INV.2T/', 'g');
    // Same with sheet name references.
    ExcelUtils.formulas_with_sheetnames = new RegExp("'[^\']*'\!" + '\\$?[A-Z][A-Z]?\\$?\\d+', 'g');
    return ExcelUtils;
}());
exports.ExcelUtils = ExcelUtils;
