import { rgb2hex, GroupedList } from 'office-ui-fabric-react';
import { ColorUtils } from './colorutils';
import { ExcelUtils } from './excelutils';
import { RectangleUtils } from './rectangleutils';
import { ExcelUtilities } from '@microsoft/office-js-helpers';
import { Timer } from './timer';
import { JSONclone } from './jsonclone';
import { find_all_proposed_fixes } from './groupme';

type excelintVector = [number, number, number];

export class Colorize {

    public static reportingThreshold = 35; //  percent of bar
    public static suspiciousCellsReportingThreshold = 85; //  percent of bar

    public static setReportingThreshold(value: number) {
	Colorize.reportingThreshold = value;
    }

    public static getReportingThreshold() : number {
	return Colorize.reportingThreshold;
    }

    // Color-blind friendly color palette.
    public static palette = ["#ecaaae", "#74aff3", "#d8e9b2", "#deb1e0", "#9ec991", "#adbce9", "#e9c59a", "#71cdeb", "#bfbb8a", "#94d9df", "#91c7a8", "#b4efd3", "#80b6aa", "#9bd1c6"]; // removed "#73dad1", 

    // True iff this class been initialized.
    private static initialized = false;

    // The array of colors (used to hash into).
    private static color_list = [];

    // A multiplier for the hash function.
    private static Multiplier = 1; // 103037;

    // A hash string indicating no dependencies.
    private static distinguishedZeroHash = "12345";

    public static initialize() {
	if (!this.initialized) {
	    // Create the color palette array.
	    const arr = Colorize.palette;
	    for (let i = 0; i < arr.length; i++) {
		this.color_list.push(arr[i]);
	    }
	    this.initialized = true;
	}
    }

    // Get the color corresponding to a hash value.
    public static get_color(hashval: number): string {
	const color = this.color_list[(hashval * 1) % this.color_list.length];
	return color;
    }

    // Generate dependence vectors and their hash for all formulas.
    public static process_formulas(formulas: Array<Array<string>>, origin_col: number, origin_row: number): Array<[excelintVector, string]> {
//	console.log("***** PROCESS FORMULAS *****");
	const base_vector = JSON.stringify(ExcelUtils.baseVector());
	const reducer = (acc:[number,number,number],curr:[number,number,number]) : [number,number,number] => [acc[0] + curr[0], acc[1] + curr[1], acc[2] + curr[2]];
	let output: Array<[[number, number,number], string]> = [];

//	console.log("process_formulas: " + JSON.stringify(formulas));
	
	// Compute the vectors for all of the formulas.
	for (let i = 0; i < formulas.length; i++) {
	    const row = formulas[i];
	    for (let j = 0; j < row.length; j++) {
		const cell = row[j].toString();
//		console.log("checking [" + cell + "]...");
		// If it's a formula, process it.
		if ((cell.length > 0)) { // FIXME MAYBE  && (row[j][0] === '=')) {
//		    console.log("processing cell " + JSON.stringify(cell) + " in process_formulas");
		    const vec_array = ExcelUtils.all_dependencies(i, j, origin_row + i, origin_col + j, formulas);
		    const adjustedX = j + origin_col + 1;
		    const adjustedY = i + origin_row + 1;
// 		    console.log("vec_array WAS = " + JSON.stringify(vec_array));
		    if (vec_array.length == 0) {
			if (cell[0] === '=') {
			    // It's a formula but it has no dependencies (i.e., it just has constants). Use a distinguished value.
			    output.push([[adjustedX, adjustedY, 0], Colorize.distinguishedZeroHash]);
			}
		    } else {
			const vec = vec_array.reduce(reducer);
			if (JSON.stringify(vec) === base_vector) {
			    // No dependencies! Use a distinguished value.
			    // FIXME RESTORE THIS output.push([[adjustedX, adjustedY, 0], Colorize.distinguishedZeroHash]);
			    output.push([[adjustedX, adjustedY, 0], vec.toString()]);
			} else {
			    const hash = this.hash_vector(vec);
			    const str = hash.toString();
//			    console.log("hash for " + adjustedX + ", " + adjustedY + " = " + str);
			    output.push([[adjustedX, adjustedY, 0], str]);
			}
		    }
		}
	    }
	}
//	console.log(JSON.stringify(all_deps));
	return output;
    }


    // Returns all referenced data so it can be colored later.
    public static color_all_data(refs: { [dep: string]: Array<excelintVector> }) : Array<[excelintVector, string]>
    { // , processed_formulas: Array<[excelintVector, string]>) {
	let t = new Timer("color_all_data");
	let referenced_data = [];
	for (let refvec of Object.keys(refs)) {
	    const rv = refvec.split(',');
	    const row = Number(rv[0]);
	    const col = Number(rv[1]);
	    referenced_data.push([[row,col,0], Colorize.distinguishedZeroHash]); // See comment at top of function declaration.
	}
	t.split("processed all data");
	return referenced_data;
    }


    // Take all values and return an array of each row and column.
    // Note that for now, the last value of each tuple is set to 1.
    public static process_values(values: Array<Array<string>>, formulas: Array<Array<string>>, origin_col: number, origin_row: number) : Array<[excelintVector, string]> {
	let value_array = [];
	let t = new Timer("process_values");
	for (let i = 0; i < values.length; i++) {
	    const row = values[i];
	    for (let j = 0; j < row.length; j++) {
		const cell = row[j].toString();
//		console.log("formulas["+i+"]["+j+"] = (" + formulas[i][j] + ")");
		// If the value is not from a formula, include it.
		if ((cell.length > 0) && ((formulas[i][j][0] != "="))) {
		    const cellAsNumber = Number(cell).toString();
		    if (cellAsNumber === cell) {
			// It's a number. Add it.
			const adjustedX = j + origin_col + 1;
			const adjustedY = i + origin_row + 1;
			value_array.push([[adjustedX, adjustedY, 1], Colorize.distinguishedZeroHash]); // See comment at top of function declaration.
		    }
		}
	    }
	}
	t.split("processed all values");
//	console.log("value_array = " + JSON.stringify(value_array));
	return value_array;
    }

    
    // Take in a list of [[row, col], color] pairs and group them,
    // sorting them (e.g., by columns).
    private static identify_ranges(list: Array<[excelintVector, string]>,
				   sortfn?: (n1: excelintVector, n2: excelintVector) => number)
    : { [val: string]: Array<excelintVector> } {
	// Separate into groups based on their string value.
	let groups = {};
	for (let r of list) {
	    groups[r[1]] = groups[r[1]] || [];
	    groups[r[1]].push(r[0]);
	}
	// Now sort them all.
	for (let k of Object.keys(groups)) {
	    //	console.log(k);
	    groups[k].sort(sortfn);
	    //	console.log(groups[k]);
	}
	return groups;
    }

    // Group all ranges by their value.
    private static group_ranges(groups: { [val: string]: Array<excelintVector> },
				columnFirst: boolean)
    : { [val: string]: Array<[excelintVector, excelintVector]> } {
	let output = {};
	let index0 = 0; // column
	let index1 = 1; // row
	if (!columnFirst) {
	    index0 = 1; // row
	    index1 = 0; // column
	}
	for (let k of Object.keys(groups)) {
	    output[k] = [];
	    let prev = groups[k].shift();
	    let last = prev;
	    for (let v of groups[k]) {
		// Check if in the same column, adjacent row (if columnFirst; otherwise, vice versa).
		if ((v[index0] === last[index0]) && (v[index1] === last[index1] + 1)) {
		    last = v;
		} else {
		    output[k].push([prev, last]);
		    prev = v;
		    last = v;
		}
	    }
	    output[k].push([prev, last]);
	}
	return output;
    }

    
    public static identify_groups(theList: Array<[excelintVector, string]>): { [val: string]: Array<[excelintVector, excelintVector]> } {
	const columnsort = (a: excelintVector, b: excelintVector) => { if (a[0] === b[0]) { return a[1] - b[1]; } else { return a[0] - b[0]; } };
	const id = this.identify_ranges(theList, columnsort);
	const gr = this.group_ranges(id, true); // column-first
	// Now try to merge stuff with the same hash.
	const newGr1 = JSONclone.clone(gr);
	const mg = this.merge_groups(newGr1);
	return mg;
    }

    public static processed_to_matrix(cols: number, rows: number,
				      origin_col: number, origin_row: number,
				      processed: Array<[excelintVector, string]>) : Array<Array<number>>
    {
	// Invert the hash table.
	// First, initialize a zero-filled matrix.
	let matrix = new Array(cols);
	for (let i = 0; i < cols; i++) {
	    matrix[i] = new Array(rows).fill(0);
	}
	// Now iterate through the processed formulas and update the matrix.
	for (let item of processed) {
	    const [[col, row, isConstant], val] = item;
	    // Yes, I know this is confusing. Will fix later.
	    //	    console.log("C) cols = " + rows + ", rows = " + cols + "; row = " + row + ", col = " + col);
	    const adjustedX = row-origin_row-1;
	    const adjustedY = col-origin_col-1;
	    let value = Number(Colorize.distinguishedZeroHash);
	    if (isConstant === 1) {
		// That means it was a constant.
		// Set to a fixed value (as above).
//		value = ; // FIXME????
	    } else {
		value = Number(val);
	    }
	    matrix[adjustedX][adjustedY] = value;
	}
	return matrix;
    }

    
    public static stencilize(cols: number, rows: number,
			     matrix : Array<Array<number>>) : Array<Array<number>>
	{
	    
	    console.log("cols = " + cols + ", rows = " + rows);
	    //	    console.log("matrix = " + JSON.stringify(matrix));
	    let stencil = new Array(cols);
	    for (let i = 0; i < cols; i++) {
		stencil[i] = new Array(rows).fill(0);
	    }
	    

	    // Middle (common-case)
	    const winMM = (i, j) => { console.log("MM: " + i + ", " + j); return [matrix[i-1][j-1], matrix[i][j-1], matrix[i+1][j-1],
								 matrix[i-1][j],   matrix[i][j],   matrix[i+1][j],
								 matrix[i-1][j+1], matrix[i][j+1], matrix[i+1][j+1]]; }
	    
	    /// Literal corner cases.
	    
	    const winTL = (i, j) => { console.log("TL"); return [matrix[i+1][j+1], matrix[i][j+1], matrix[i+1][j+1],
								 matrix[i+1][j],   matrix[i][j],   matrix[i+1][j],
								 matrix[i+1][j+1], matrix[i][j+1], matrix[i+1][j+1]]; }

	    const winBL = (i, j) => { console.log("BL"); return [matrix[i+1][j-1], matrix[i][j-1], matrix[i+1][j-1],
								 matrix[i+1][j],   matrix[i][j],   matrix[i+1][j],
								 matrix[i+1][j-1], matrix[i][j-1], matrix[i+1][j-1]]; }

	    const winTR = (i, j) => { console.log("TR"); return [matrix[i-1][j+1], matrix[i][j+1], matrix[i-1][j+1],
								 matrix[i-1][j],   matrix[i][j],   matrix[i-1][j],
								 matrix[i-1][j+1], matrix[i][j+1], matrix[i-1][j+1]]; }
	    
	    const winBR = (i, j) => { console.log("BR"); return [matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j-1],
								 matrix[i-1][j],   matrix[i][j],   matrix[i-1][j],
								 matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j-1]]; }
	    
	    /// Literal edge cases
	    const winT = (i, j) => { console.log("T"); return [matrix[i+1][j+1], matrix[i][j+1], matrix[i+1][j+1],
							       matrix[i+1][j],   matrix[i][j],   matrix[i+1][j],
							       matrix[i+1][j+1], matrix[i][j+1], matrix[i+1][j+1]]; }
	    
	    const winR = (i, j) => { console.log("R: "+ i + ", " + j); return [matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j-1],
							       matrix[i-1][j],   matrix[i][j],   matrix[i-1][j],
							       matrix[i-1][j+1], matrix[i][j+1], matrix[i-1][j+1]]; }
	    
	    const winL = (i, j) => { console.log("L"); return [matrix[i+1][j-1], matrix[i][j-1], matrix[i+1][j-1],
							       matrix[i+1][j],   matrix[i][j],   matrix[i+1][j],
							       matrix[i+1][j+1], matrix[i][j+1], matrix[i+1][j+1]]; }
	    
	    const winB = (i, j) => { console.log("B"); return [matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j-1],
							       matrix[i-1][j],   matrix[i][j],   matrix[i-1][j],
							       matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j-1]]; }
	    
	    const stencilFunction = (win, i, j) => {
		const theWin = win(j, i); // NOTE reversal!
		if (theWin.reduce((total, a) => (a === null) || (Boolean(total)), false)) {
		    // There's a null.
		    console.log("busted: " + JSON.stringify(win(i, j)));
		}
		const sum = theWin.reduce((total,a) => total + a, 0);
		const nonzeros = theWin.reduce((total, a) => { if (Number(a) > 0) { return total + 1; } else { return total; }}, 0);
		if (nonzeros > 0) {
		    const mean = sum / nonzeros;
		    //			const variance = win.reduce((total, a) => total + (a - mean) * (a - mean));
		    //			let counts = {};
		    //			win.forEach(el => counts[el] = 1  + (counts[el] || 0));
		    //			delete counts[0];
		    // stencil[i][j] = Object.keys(counts).length; // variance; //  mean;
		    stencil[i][j] = mean;
		}
		// Avoid math issues by rounding so we only use the first two significant digits past the decimal point.
		stencil[i][j] = Math.round(stencil[i][j] * 100) / 100;
	    };

	    let win;
	    let win_counts = {};

//	    for (let i = 0; i < cols; i++) {
//		for (let j = 0; j < rows; j++) {

		    for (let i = 1; i < cols-1; i++) {
			for (let j = 1; j < rows-1; j++) {
		    win = null;
		    switch (i) {
		    case 0:
			switch (j) {
			case 0:
			    win = winTL; win_counts["TL"] = 1 + (win_counts["TL"] || 0);  break;
			case rows-1:
			    win = winTR; win_counts["TR"] = 1 + (win_counts["TR"] || 0);  break;
			default:
			    win = winT; win_counts["T"] = 1 + (win_counts["T"] || 0);  break;
			}
			break;
		    case cols-1:
			switch (j) {
			case 0:
			    win = winBL; win_counts["BL"] = 1 + (win_counts["BL"] || 0);  break;
			case rows-1:
			    win = winBR; win_counts["BR"] = 1 + (win_counts["BR"] || 0);  break;
			default:
			    win = winB; win_counts["B"] = 1 + (win_counts["B"] || 0);  break;
			}
			break;
		    default:
			switch (j) {
			case 0:
			    win = winL; win_counts["L"] = 1 + (win_counts["L"] || 0);  break;
			case rows-1:
			    win = winR; win_counts["R"] = 1 + (win_counts["R"] || 0); break;
			default:
			    win = winMM; win_counts["MM"] = 1 + (win_counts["MM"] || 0);  break;
			}
		    }
		    stencilFunction(win, i, j);
//		    if (win === winR) {
//			console.log(JSON.stringify(win(i,j)));
//			console.log("stencil[" + i + "][" + j + "] = " + stencil[i][j]);
//		    }
		}
	    }

	    console.log(JSON.stringify(win_counts));
	    
//	    console.log("Stencil = " + JSON.stringify(stencil));
	return stencil;
    }

    public static compute_stencil_probabilities(cols: number, rows: number,
						stencil : Array<Array<number>>) : Array<Array<number>>
	{
	    let probs = new Array(cols);
	    for (let i = 0; i < cols; i++) {
		probs[i] = new Array(rows).fill(0);
	    }
	    // Generate the counts.
	    let totalNonzeroes = 0;
	    let counts = {};
	    for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
		    counts[stencil[i][j]] = (counts[stencil[i][j]] + 1) || 1;
		    if (stencil[i][j] != 0) {
			totalNonzeroes += 1;
		    }
		}
	    }
	    
	    console.log("counts = " + JSON.stringify(counts));
	    
//	    console.log("**********************total non-zeroes = " + totalNonzeroes);
	    // Now iterate over the counts to compute probabilities.
	    for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
		    probs[i][j] = counts[stencil[i][j]] / totalNonzeroes;
		}
	    }
	    
//	    console.log("probs = " + JSON.stringify(probs));
	    
	    let totalEntropy = 0;
	    let total = 0;
	    for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
		    if (stencil[i][j] > 0) {
			total += counts[stencil[i][j]];
		    }
		}
	    }

	    for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
		    if (counts[stencil[i][j]] > 0) {
			totalEntropy += this.entropy(counts[stencil[i][j]] / total);
		    }
		}
	    }
	    
	    const normalizedEntropy = totalEntropy / Math.log2(totalNonzeroes);

	    // Now discount the probabilities by weighing them by the normalized total entropy.
	    if (false) {
		for (let i = 0; i < cols; i++) {
		    for (let j = 0; j < rows; j++) {
			probs[i][j] *= normalizedEntropy;
			//			totalEntropy += this.entropy(probs[i][j]);
		    }
		}
	    }

//	    console.log("new probs = " + JSON.stringify(probs));
	    console.log("total probability = " + total);
	    console.log("total entropy = " + totalEntropy);
	    console.log("normalized entropy = " + normalizedEntropy);
	    return probs;
	}
    

    public static generate_suspicious_cells(cols: number, rows: number,
					    origin_col:  number, origin_row: number,
					    matrix : Array<Array<number>>,
					    probs : Array<Array<number>>,
					    threshold = 0.01) : Array<excelintVector>
	{
	    console.log("threshold = " + threshold);
	    let cells = [];
	    let sumValues = 0;
	    let countValues = 0;
	    for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
		    const adjustedX = j + origin_col + 1;
		    const adjustedY = i + origin_row + 1;
//		    console.log("examining " + i + " " + j + " = " + matrix[i][j] + " (" + adjustedX + ", " + adjustedY + ")");
		    if (probs[i][j] > 0) {
			sumValues += matrix[i][j];
			countValues += 1;
			if (probs[i][j] <= threshold) {
			    console.log("found one at " + i + " " + j + " = [" + matrix[i][j] + "] (" + adjustedX + ", " + adjustedY + "): p = " + probs[i][j]);
			    if (matrix[i][j] != 0) {
				console.log("PUSHED!");
				// Never push an empty cell.
				cells.push([adjustedX, adjustedY, probs[i][j]]);
			    }
			}
		    }
		}
	    }
	    const avgValues = sumValues / countValues;
	    console.log("avg values = " + avgValues);
	    cells.sort((a, b) => { return Math.abs(b[2] - avgValues) - Math.abs(a[2] - avgValues); });
	    //	    console.log("cells = " + JSON.stringify(cells));
	    return cells;
	}
    
    
    // Shannon entropy.
    public static entropy(p: number): number {
	return -p * Math.log2(p);
    }

    // Take two counts and compute the normalized entropy difference that would result if these were "merged".
    public static entropydiff(oldcount1, oldcount2) {
	const total = oldcount1 + oldcount2;
	const prevEntropy = this.entropy(oldcount1/total) + this.entropy(oldcount2/total);
	const normalizedEntropy = prevEntropy / (Math.log2(total));
	return -normalizedEntropy;
    }

    // Compute the normalized distance from merging two ranges.
    public static fix_metric(target_norm: number,
			     target: [excelintVector, excelintVector],
			     merge_with_norm: number,
			     merge_with: [excelintVector, excelintVector]): number
    {
//	console.log("fix_metric: " + target_norm + ", " + JSON.stringify(target) + ", " + merge_with_norm + ", " + JSON.stringify(merge_with));
	const [t1, t2] = target;
	const [m1, m2] = merge_with;
	const n_target = RectangleUtils.area([[t1[0], t1[1], 0], [t2[0], t2[1], 0]]);
	const n_merge_with = RectangleUtils.area([[m1[0], m1[1], 0], [m2[0], m2[1], 0]]);
	const n_min = Math.min(n_target, n_merge_with);
	const n_max = Math.max(n_target, n_merge_with);
	const norm_min = Math.min(merge_with_norm, target_norm);
 	const norm_max = Math.max(merge_with_norm, target_norm);
	let fix_distance = Math.abs(norm_max - norm_min) / this.Multiplier;
	// Ensure that the minimum fix is at least one (we need this if we don't use the L1 norm).
	if (fix_distance < 1.0) {
	    fix_distance = 1.0;
	}
	const entropy_drop = this.entropydiff(n_min, n_max); // negative
	let ranking = (1.0 + entropy_drop) / (fix_distance * n_min); // ENTROPY WEIGHTED BY FIX DISTANCE
	ranking = -ranking; // negating to sort in reverse order.
	return ranking;
    }

    // Iterate through the size of proposed fixes.
    public static count_proposed_fixes(fixes: Array<[number, [excelintVector, excelintVector], [excelintVector, excelintVector]]>) : number
    {
	let count = 0;
	for (let k in fixes) {
	    //	    console.log("FIX FIX FIX fixes[k] = " + JSON.stringify(fixes[k][1]));
	    const [f11, f12] = fixes[k][1];
	    const [f21, f22] = fixes[k][2];
	    count += RectangleUtils.diagonal([[f11[0], f11[1], 0], [f12[0], f12[1], 0]]);
	    count += RectangleUtils.diagonal([[f21[0], f21[1], 0], [f22[0], f22[1], 0]]);
	}
	return count;
    }

    // Try to merge fixes into larger groups.
    public static fix_proposed_fixes(fixes: Array<[number, [excelintVector, excelintVector], [excelintVector, excelintVector]]>) :
    Array<[number, [excelintVector, excelintVector], [excelintVector, excelintVector]]>
	{
	    // example: [[-0.8729568798082977,[[4,23],[13,23]],[[3,23,0],[3,23,0]]],[-0.6890824929174288,[[4,6],[7,6]],[[3,6,0],[3,6,0]]],[-0.5943609377704335,[[4,10],[6,10]],[[3,10,0],[3,10,0]]],[-0.42061983571430495,[[3,27],[4,27]],[[5,27,0],[5,27,0]]],[-0.42061983571430495,[[4,14],[5,14]],[[3,14,0],[3,14,0]]],[-0.42061983571430495,[[6,27],[7,27]],[[5,27,0],[5,27,0]]]]
	    let count = 0;
	    // Search for fixes where the same coordinate pair appears in the front and in the back.
	    let front = {};
	    let back = {};
	    // Build up the front and back dictionaries.
	    for (let k in fixes) {
		// Sort the fixes so the smaller array (further up and
		// to the left) always comes first.
		if (fixes[k][1] > fixes[k][2]) {
		    const tmp = fixes[k][1];
		    fixes[k][1] = fixes[k][2];
		    fixes[k][2] = tmp;
		}
		// Now add them.
		front[JSON.stringify(fixes[k][1])] = fixes[k];
		back[JSON.stringify(fixes[k][2])] = fixes[k];
	    }
	    // Now iterate through one, looking for hits on the other.
	    let new_fixes = [];
	    let merged = {};
	    for (let k in fixes) {
		const original_score = fixes[k][0];
		if (-original_score < (Colorize.reportingThreshold / 100)) {
		    continue;
		}
		const this_front_str = JSON.stringify(fixes[k][1]);
		const this_back_str = JSON.stringify(fixes[k][2]);
		if (!(this_front_str in back) && !(this_back_str in front)) {
		    // No match. Just merge them.
		    new_fixes.push(fixes[k]);
		} else {
//		    console.log("**** original score = " + original_score);
		    if ((!merged[this_front_str]) && (this_front_str in back)) {
//			console.log("**** (1) merging " + this_front_str + " with " + JSON.stringify(back[this_front_str]));
			// FIXME. This calculation may not make sense.			
			let newscore = -original_score * JSON.parse(back[this_front_str][0]);
//			console.log("pushing " + JSON.stringify(fixes[k][1]) + " with " + JSON.stringify(back[this_front_str][1]));
			const new_fix = [newscore, fixes[k][1], back[this_front_str][1]];
//			console.log("pushing " + JSON.stringify(new_fix));
			new_fixes.push(new_fix);
			merged[this_front_str] = true;
			// FIXME? testing below. The idea is to not keep merging things (for now).
			merged[this_back_str] = true;
			continue;
		    }
		    if ((!merged[this_back_str]) && (this_back_str in front)) {
			// this_back_str in front
//			console.log("**** (2) merging " + this_back_str + " with " + JSON.stringify(front[this_back_str]));
			// FIXME. This calculation may not make sense.
			const newscore = -original_score * JSON.parse(front[this_back_str][0]);
			//			console.log("pushing " + JSON.stringify(fixes[k][1]) + " with " + JSON.stringify(front[this_back_str][1]));
			const new_fix = [newscore, fixes[k][1], front[this_back_str][2]];
//			console.log("pushing " + JSON.stringify(new_fix));
			new_fixes.push(new_fix);
			merged[this_back_str] = true;
			// FIXME? testing below.
			merged[this_front_str] = true;
			
		    }
		}
	    }
	    return new_fixes;
	}

    public static generate_proposed_fixes(groups: { [val: string]: Array<[excelintVector, excelintVector]> }):
    Array<[number, [excelintVector, excelintVector], [excelintVector, excelintVector]]> {
	let t = new Timer("generate_proposed_fixes");
	t.split("about to find.");
	let proposed_fixes_new = find_all_proposed_fixes(groups);
	t.split("sorting fixes.");
	proposed_fixes_new.sort((a, b) => { return a[0] - b[0]; });
	t.split("done.");
//	console.log(JSON.stringify(proposed_fixes_new));
	return proposed_fixes_new;
    }

    public static merge_groups(groups: { [val: string]: Array<[excelintVector, excelintVector]> })
    : { [val: string]: Array<[excelintVector, excelintVector]> } {
	for (let k of Object.keys(groups)) {
	    const g = groups[k].slice();
	    groups[k] = this.merge_individual_groups(g); // JSON.parse(JSON.stringify(groups[k])));
	}
	return groups;
    }

    public static merge_individual_groups(group: Array<[excelintVector, excelintVector]>)
    : Array<[excelintVector, excelintVector]>
	{
	    let t = new Timer("merge_individual_groups");
	    let numIterations = 0;
	    group = group.sort();
	    //        console.log(JSON.stringify(group));
	    while (true) {
		// console.log("iteration "+numIterations);
		let merged_one = false;
		let deleted_rectangles = {};
		let updated_rectangles = [];
		let working_group = group.slice(); // JSON.parse(JSON.stringify(group));
		while (working_group.length > 0) {
		    const head = working_group.shift();
		    for (let i = 0; i < working_group.length; i++) {
			//                    console.log("comparing " + head + " and " + working_group[i]);
			if (RectangleUtils.is_mergeable(head, working_group[i])) {
			    //console.log("friendly!" + head + " -- " + working_group[i]);
			    updated_rectangles.push(RectangleUtils.bounding_box(head, working_group[i]));
			    deleted_rectangles[JSON.stringify(head)] = true;
			    deleted_rectangles[JSON.stringify(working_group[i])] = true;
			    merged_one = true;
			    break;
			}
		    }
		    //                if (!merged_one) {
		    //                    updated_rectangles.push(head);
		    //                }
		}
		for (let i = 0; i < group.length; i++) {
		    if (!(JSON.stringify(group[i]) in deleted_rectangles)) {
			updated_rectangles.push(group[i]);
		    }
		}
		updated_rectangles.sort();
		// console.log('updated rectangles = ' + JSON.stringify(updated_rectangles));
		//            console.log('group = ' + JSON.stringify(group));
		if (!merged_one) {
		    // console.log('updated rectangles = ' + JSON.stringify(updated_rectangles));
//		    t.split("done, " + numIterations + " iterations.");
		    return updated_rectangles;
		}
		group = updated_rectangles.slice(); // JSON.parse(JSON.stringify(updated_rectangles));
		numIterations++;
		if (numIterations > 2000) { // This is hack to guarantee convergence.
		    console.log("Too many iterations; abandoning this group.")
		    t.split("done, " + numIterations + " iterations.");
		    return [[[-1, -1, 0], [-1, -1, 0]]];
		}
	    }
	}

    public static hash_vector(vec: Array<number>): number {
	const useL1norm = false;
	if (useL1norm) {
	    const baseX = 0; // 7;
	    const baseY = 0; // 3;
	    const v0 = Math.abs(vec[0] - baseX);
	    //	v0 = v0 * v0;
	    const v1 = Math.abs(vec[1] - baseY);
	    //	v1 = v1 * v1;
	    const v2 = vec[2];
	    return this.Multiplier * (v0 + v1 + v2);
	} else {
	    let baseX = -7; // was 7
	    let baseY = -3; // was 3
	    let	v0 = vec[0] - baseX;
	    v0 = v0 * v0;
	    let v1 = vec[1] - baseY;
	    v1 = v1 * v1;
	    const v2 = vec[2];
	    return this.Multiplier * Math.sqrt(v0 + v1 + v2);
	}
	//	return this.Multiplier * (Math.sqrt(v0 + v1) + v2);
    }
}

//console.log(this.dependencies('$C$2:$E$5', 10, 10));
//console.log(this.dependencies('$A$123,A1:B$12,$A12:$B$14', 10, 10));
//console.log(this.hash_vector(this.dependencies('$C$2:$E$5', 10, 10)));
