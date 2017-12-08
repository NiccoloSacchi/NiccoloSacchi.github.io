import {drawCategoryGraph} from './categories_graph.js'
import {ProductGraph} from './product_graph.js'

let p
let autocomp

// functions to manage search and autocompletion
export function pageInit() {
    drawCategoryGraph();
    p = new ProductGraph();
    p.drawGraph('product_graph', 'graph_1.json');

    autocomp = new autoComplete({
        selector: '#productSearchBox',
        minChars: 1,
        source: function (term, suggest) {
            term = term.toLowerCase();
            let matches = [];
            for (let i = 0; i < p.choices.length; i++) {
                if (p.choices[i].toLowerCase().indexOf(term)>=0) {
                    matches.push(p.choices[i]);
                }
                if (matches.length >= 10) {
                    break
                }
            }
            suggest(matches);
        }
    });
}

export function filterProducts(keywords){
    // set show to true only the product nodes corresponding with the keyword
    let products = p.net.nodes.filter(n => {
            n.show = (n.name.toLowerCase().indexOf(keywords) >= 0)
            return n.show
        }
    )

    // mark a showable all the reachable nodes
    dfs_show(products)

    // // if a group contains at least one product to be shown then show also this group
    // p.net.nodes.forEach(n =>{
    //         if (n instanceof GroupNode){
    //             // if (!n.nodes.every(n=>n.show) && !n.nodes.every(n=>!n.show)){
    //             //     console.log("the shit hit the fan")
    //             // }
    //             // if so show also the respective group
    //             n.show = n.nodes.map(n => n.show).includes(true)
    //         }
    //     }
    // )

    p.updateGraph()
}

function dfs_show(nodes) {
    // the bfs is done considering only the product nodes

    // (unique) list of non-explored neighbours
    let neighbours = Array.from(
        new Set(
            nodes
                .reduce((acc, n) => acc.concat(n.neighbours.filter(n => !n.show)), [])));
    // set the neighbours as seen
    neighbours.forEach(n => n.show = true)
    if (neighbours.length > 0) {
        dfs_show(neighbours)
    }
}

window.pageInit = pageInit
window.filterProducts = filterProducts