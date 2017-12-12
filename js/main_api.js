import {CategoryGraph} from './categories_graph.js'
import {ProductGraph} from './products_graph.js'

let p, c

// functions to manage search and autocompletion
export function pageInit() {
    c = new CategoryGraph();
    c.drawGraph('categories_graph', 'data/categories.json')

    p = new ProductGraph();
    p.drawGraph('product_graph', 'data/graph_4.json', true, true, true, true);
}

window.pageInit = pageInit