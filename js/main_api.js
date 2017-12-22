let p, c
c = new CategoryGraph()

// functions to manage search and autocompletion
function pageInit() {
    c.drawGraph('search-tool', 'data/categories.json', category_callback)
    // setTimeout(()=>category_callback("tools-home-improvement--building-supplies--heating-cooling--ducting.json", "ducting"), 500)
}

function category_callback(url, categoryName){
    p = new ProductGraph()
    p.drawGraph('search-tool', 'data/graphs/'+url, categoryName, product_callback, true, true, true);
}

function product_callback() {
    c.drawGraph('search-tool', 'data/categories.json', category_callback)
}