import {CategoryGraph} from './categories_graph.js'
import {ProductGraph} from './products_graph.js'

let p, c
c = new CategoryGraph()

// // functions to manage search and autocompletion
// export function pageInit() {
//     c = new CategoryGraph();
//     c.drawGraph('categories_graph', 'data/categories.json')
//
//     p = new ProductGraph();
//     p.drawGraph('product_graph', 'data/graph_4.json', true, true, true, true);
// }


// functions to manage search and autocompletion
export function pageInit() {
    c.drawGraph('search-tool', 'data/categories.json', category_callback)
    // setTimeout(()=>category_callback("tools-home-improvement--building-supplies--heating-cooling--ducting.json"), 500)
}

function category_callback(url){
    p = new ProductGraph()
    p.drawGraph('search-tool', 'data/graphs/'+url, product_callback, true, true, true);
}

function product_callback(){
    c.drawGraph('search-tool', 'data/categories.json', category_callback)
}



export function drawCategoryGraph(divId){
    c.drawGraph(divId, 'data/categories.json', null)
}

window.pageInit = pageInit
window.drawCategoryGraph = drawCategoryGraph