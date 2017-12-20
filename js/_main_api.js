import {CategoryGraph} from './_categories_graph.js'

let c = new CategoryGraph()

export function drawCategoryGraph(divId){
    c.drawGraph(divId, 'data/_categories.json', null)
}

window.drawCategoryGraph = drawCategoryGraph