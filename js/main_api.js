import {CategoryGraph} from './categories_graph.js'
import {ProductGraph} from './product_graph.js'

let p, c

// functions to manage search and autocompletion
export function pageInit() {
    c = new CategoryGraph();
    c.drawGraph('categories_graph', 'data/categories.json')

    // p = new ProductGraph();
    // p.drawGraph('product_graph', 'graph_1.json', true);
}

window.pageInit = pageInit