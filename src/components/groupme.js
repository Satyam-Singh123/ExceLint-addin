"use strict";
exports.__esModule = true;
var binsearch_1 = require("./binsearch");
var colorize_1 = require("./colorize");
// Enable reasonable comparisons of numbers by converting them to zero-padded strings
// so that 9 < 56 (because "0009" < "0056").
function fix(n) {
    return n.toString().padStart(10, '0');
}
// Apply fixes to an array.
function fix_array(arr) {
    return arr.map(function (x, _1, _2) { return fix(x); });
}
// Apply fixes to a pair.
function fix_pair(p) {
    var p1 = p[0], p2 = p[1];
    return [fix_array(p1), fix_array(p2)];
}
// A comparison function to sort by x-coordinate.
function sort_x_coord(a, b) {
    var a1 = a[0], a2 = a[1];
    var b1 = b[0], b2 = b[1];
    if (a1[0] != b1[0]) {
        return (a1[0] - b1[0]);
    }
    else {
        return (a1[1] - b1[1]);
    }
}
// A comparison function to sort by y-coordinate.
function sort_y_coord(a, b) {
    var a1 = a[0], a2 = a[1];
    var b1 = b[0], b2 = b[1];
    if (a1[1] != b1[1]) {
        return (a1[1] - b1[1]);
    }
    else {
        return (a1[0] - b1[0]);
    }
}
function fix_grouped_formulas(g, newGnum) {
    for (var _i = 0, _a = Object.keys(g); _i < _a.length; _i++) {
        var i = _a[_i];
        if (true) {
            newGnum[i] = g[i].sort(sort_x_coord).map(function (x, _1, _2) {
                return [x[0].map(function (a, _1, _2) { return Number(a); }),
                    x[1].map(function (a, _1, _2) { return Number(a); })];
            });
        }
        else {
            // The below is maybe too inefficient; possibly revisit.
            var newGstr = {};
            newGstr[i] = g[i].map(function (p, _1, _2) { return fix_pair(p); });
            newGstr[i].sort(sort_x_coord);
            newGnum[i] = newGstr[i].map(function (x, _1, _2) {
                return [x[0].map(function (a, _1, _2) { return Number(a); }),
                    x[1].map(function (a, _1, _2) { return Number(a); })];
            });
        }
    }
}
// Knuth-Fisher-Yates shuffle (not currently used).
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}
//test_binsearch();
var comparisons = 0;
function numComparator(a_val, b_val) {
    for (var i = 0; i < 3; i++) { // note: length of excelint vector
        if (a_val[i] < b_val[i]) {
            return -1;
        }
        if (a_val[i] > b_val[i]) {
            return 1;
        }
    }
    return 0;
}
function matching_rectangles(rect_ul, rect_lr, rect_uls, rect_lrs) {
    // Assumes uls and lrs are already sorted and the same length.
    var x1 = rect_ul[0];
    var y1 = rect_ul[1];
    var x2 = rect_lr[0];
    var y2 = rect_lr[1];
    // Try to find something adjacent to A = [[x1, y1, 0], [x2, y2, 0]]
    // options are:
    //   [x1-1, y2] left (lower-right)   [ ] [A] --> [ (?, y1) ... (x1-1, y2) ]
    //   [x2, y1-1] up (lower-right)     [ ]
    //                                   [A] --> [ (x1, ?) ... (x2, y1-1) ]
    //   [x2+1, y1] right (upper-left)   [A] [ ] --> [ (x2 + 1, y1) ... (?, y2) ]
    //   [x1, y2+1] down (upper-left)    [A]
    //                                   [ ] --> [ (x1, y2+1) ... (x2, ?) ]
    // left (lr) = ul_x, lr_y
    var left = [x1 - 1, y2, 0];
    // up (lr) = lr_x, ul_y
    var up = [x2, y1 - 1, 0];
    // right (ul) = lr_x, ul_y
    var right = [x2 + 1, y1, 0];
    // down (ul) = ul_x, lr_y
    var down = [x1, y2 + 1, 0];
    var matches = [];
    var ind = -1;
    ind = binsearch_1.binsearch(rect_lrs, left, numComparator);
    //	console.log("left = " + ind);
    if (ind != -1) {
        if (rect_uls[ind][1] === y1) {
            var candidate = [rect_uls[ind], rect_lrs[ind]];
            matches.push(candidate);
        }
    }
    ind = binsearch_1.binsearch(rect_lrs, up, numComparator);
    //	console.log("up = " + ind);
    if (ind != -1) {
        if (rect_uls[ind][0] === x1) {
            var candidate = [rect_uls[ind], rect_lrs[ind]];
            matches.push(candidate);
        }
    }
    ind = binsearch_1.binsearch(rect_uls, right, numComparator);
    //	console.log("right = " + ind);
    if (ind != -1) {
        if (rect_lrs[ind][1] === y2) {
            var candidate = [rect_uls[ind], rect_lrs[ind]];
            matches.push(candidate);
        }
    }
    ind = binsearch_1.binsearch(rect_uls, down, numComparator);
    //	console.log("down = " + ind);
    if (ind != -1) {
        if (rect_lrs[ind][0] === x2) {
            var candidate = [rect_uls[ind], rect_lrs[ind]];
            matches.push(candidate);
        }
    }
    return matches;
}
var rectangles_count = 0;
function find_all_matching_rectangles(thisKey, rect, grouped_formulas, x_ul, x_lr) {
    var base_ul = rect[0], base_lr = rect[1];
    //    console.log("Looking for matches of " + JSON.stringify(base_ul) + ", " + JSON.stringify(base_lr));
    var match_list = [];
    var a = grouped_formulas;
    var _loop_1 = function (key) {
        if (key === thisKey) {
            return "continue";
        }
        rectangles_count++;
        if (rectangles_count % 1000 === 0) {
            //	    if (true) { // rectangles_count % 1000 === 0) {
            console.log("find_all_matching_rectangles, iteration " + rectangles_count);
        }
        var matches = matching_rectangles(base_ul, base_lr, x_ul[key], x_lr[key]);
        if (matches.length > 0) {
            //	    console.log("found matches for key "+key+" --> " + JSON.stringify(matches));
        }
        match_list = match_list.concat(matches.map(function (item, _1, _2) {
            var metric = colorize_1.Colorize.fix_metric(parseFloat(thisKey), rect, parseFloat(key), item);
            return [metric, rect, item];
        }));
    };
    for (var _i = 0, _a = Object.keys(a); _i < _a.length; _i++) {
        var key = _a[_i];
        _loop_1(key);
    }
    //	console.log("match_list = " + JSON.stringify(match_list));
    return match_list;
}
// Returns an array with all duplicated entries removed.
function dedup(arr) {
    var t = {};
    return arr.filter(function (e) { return !(t[e] = e in t); });
}
function find_all_proposed_fixes(grouped_formulas) {
    var all_matches = [];
    var count = 0;
    rectangles_count = 0;
    var aNum = {};
    fix_grouped_formulas(grouped_formulas, aNum);
    var x_ul = {};
    var x_lr = {};
    for (var _i = 0, _a = Object.keys(grouped_formulas); _i < _a.length; _i++) {
        var key = _a[_i];
        x_ul[key] = aNum[key].map(function (i, _1, _2) { var p1 = i[0], p2 = i[1]; return p1; });
        x_lr[key] = aNum[key].map(function (i, _1, _2) { var p1 = i[0], p2 = i[1]; return p2; });
    }
    for (var _b = 0, _c = Object.keys(grouped_formulas); _b < _c.length; _b++) {
        var key = _c[_b];
        for (var i = 0; i < aNum[key].length; i++) {
            var matches = find_all_matching_rectangles(key, aNum[key][i], aNum, x_ul, x_lr);
            all_matches = all_matches.concat(matches);
            count++;
            if (count % 1000 == 0) {
                console.log("find_all_proposed_fixes, iteration " + count);
            }
        }
    }
    if (false) {
        all_matches = all_matches.map(function (x, _1, _2) {
            return [x[0].map(function (a, _1, _2) { return Number(a); }),
                x[1].map(function (a, _1, _2) { return Number(a); })];
        });
    }
    //    console.log("before: " + JSON.stringify(all_matches));
    all_matches = all_matches.map(function (x, _1, _2) {
        if (numComparator(x[1], x[2]) < 0) {
            return [x[0], x[2], x[1]];
        }
        else {
            return [x[0], x[1], x[2]];
        }
    });
    all_matches = dedup(all_matches);
    //   console.log("after: " + JSON.stringify(all_matches));
    return all_matches;
}
exports.find_all_proposed_fixes = find_all_proposed_fixes;
function test_find_all_proposed_fixes(grouped_formulas) {
    comparisons = 0;
    var all_fixes = find_all_proposed_fixes(grouped_formulas);
    console.log("all matches = " + JSON.stringify(all_fixes));
    console.log("comparisons = " + comparisons);
    var theLength = 0;
    for (var _i = 0, _a = Object.keys(grouped_formulas); _i < _a.length; _i++) {
        var k = _a[_i];
        theLength += grouped_formulas[k].length;
    }
    console.log("total length of grouped_formulas = " + theLength);
}
exports.test_find_all_proposed_fixes = test_find_all_proposed_fixes;
//let r = require('./grouped_formulas.js');
//test_find_all_proposed_fixes(r.grouped_formulas);
