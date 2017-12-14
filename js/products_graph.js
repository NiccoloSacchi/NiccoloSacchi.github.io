export class ProductGraph {
    constructor() {
        // default initializations of the parameters (can be changed to modify the graph)
        // height and width of the whole div
        this.width = d3.select("body").node().getBoundingClientRect().width;
        this.height = 450
        this.off = 10;    // cluster hull offset
        this.net = {"nodes":[], "links": [], "cliques": {}};  // all nodes (either products or groups) and links
        this.choices = [];

        this.bestProducts = {"nodes": [], "view": null}
        this.focusednode = d3.select("#asdjhasjdhg") // asin of the highlighted node

        this.brushHeight = 25
        // this.simulation; this.hullg; this.linkg; this.nodeg; these are set at runtime
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        this.drawHull = (d) =>
            d3.line().curve(d3.curveCardinalClosed.tension(.85))(d.path); // 0.8
    }

    drawGraph(divId, file, searchbox, productWindow, priceBrush, bestProducts){
        // divId: id of the div in which to draw the search bar and the graph
        // file: path to the file containing the graph
        // searchbox: boolean to indicate whether draw a searchbox
        // productWindow: boolean to indicate whether reserve part of the div
        //                the details of the mouse-overed product
        // priceBrush: boolean to indicate whether draw a brush to select an
        //             interval of prices
        // bestProducts: boolean to indicate whether show the best products
        //             of the showed graph

        let that = this

        // select the div
        let div = d3.select("#"+divId)
            .style("width", this.width)
            .style("height", this.height)
        // clear the div content
        div.selectAll("*").remove();

        if(searchbox) {
            // append the search box
            // <!-- search box -->
            // <section class="webdesigntuts-workshop" >
            //     <div>
            //         <input id="productSearchBox" placeholder="product">
            //         <button onclick="filterProducts(document.getElementById('productSearchBox').value)">Search</button>
            //     </div>
            // </section>
            let box = div.append("section")
                .attr("class", "webdesigntuts-workshop")
                .append("div")
            let input = box.append("input")
                .attr("id", "productSearchBox")
                .attr("placeholder", "product")
            box.append("button")
                .on("click", () => this.filterProducts(input.node().value))
                .text("search")
        }

        let table = div.append("table")
            .attr("class", "product_table")

        let row1 = table.append("tr")
        let ncolumns = 1 + bestProducts + productWindow
        if (bestProducts){
            // in this.bestProducts["view"] we will show the first 10 shown nodes
            // of this.bestProducts["nodes"]
            let column = row1.append("td")
                .style("width", (100/ncolumns) + "%")
                .style("padding", 3+"px")
                .style("height", this.height+"px")
            column.append("h4")
                .text("Best products")
                .style("height", "7%")
                .style("margin", 0+"px")
            this.bestProducts["view"] =
                column
                    .append("div")
                    .style("width", "100%")
                    .style("height", "93%")
                    .style("overflow-y", "scroll")
                    .style("margin", 0+"px")
                    // .attr("class", "bestProducts")
        }

        let graph_view = row1.append("td")
            .style("padding", 0)
            .style("width", (100/ncolumns) + "%")
            .style("height", this.height+"px")

        if (productWindow){
            // then create a table, on the left we show the graph
            // on the right the details of the product
            let column = row1.append("td")
                .style("width", (100/ncolumns) + "%")
                .style("padding", 3+"px")
                .style("height", this.height+"px")
            column.append("h4")
                .text("Selected product")
                .style("height", "7%")
                .style("margin", 0+"px")
            this.productWindow =
                // .style("height", this.height+"px")
                 column.append("div")
                     .style("width", "100%")
                     .style("height", "93%")
                     .style("overflow-y", "scroll")
                     .style("margin", 0+"px")
        }

        if (priceBrush){
            // let margin = {top: 0, right: 5, bottom: 0, left: 5}
            let div = table
                .append("tr")
                .append("td").attr("colspan", 100).style("padding", 0)
                .append("div").style("margin", "0px 15px")

            div.append("h6").text("Select a price interval")
                // .style("margin", "auto")
                .style("text-align", "center").style("margin", "0px")

            this.priceBrush = div
                .append("svg").style("overflow", "visible")
                .attr("class", "priceBrush")
                .attr("height", this.brushHeight)
                .attr('transform', 'translate(0, 2)')
        }

        this.zoom = d3.zoom()
        //        .scaleExtent([1, 40])
        //        .translateExtent([[-100, -100], [width + 90, height + 100]])
            .on("zoom", () => {
                this.svg.selectAll("g").attr("transform", d3.event.transform);
            })
        // append the svg to draw the graph
        this.svg = graph_view.append("svg")
            .attr("class", "product_graph")
            // set height and width, add zoom and drag
            .attr("width", "100%")
            .attr("height", "100%")
            .call(this.zoom);

        // define arrow markers for graph links (directed edges)
        let defs = this.svg.append('defs');
        defs.append('marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 23)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('stroke', 'black')
            .attr('stroke-opacity', 0.7)
            .attr('stroke-width', 3)
            .attr('fill', 'none')

        defs.append('marker')
            .attr('id', 'start-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', -13)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M10,-5L0,0L10,5')
            .attr('stroke', 'black')
            .attr('stroke-opacity', 0.7)
            .attr('stroke-width', 3)
            .attr('fill', 'none')

        // when drawing make the graph appear "smoothly"
        this.svg.attr("opacity", 1e-6)
            .transition()
            .duration(1000)
            .attr("opacity", 1);

        d3.json(file, (error, json) => {
            if (error) throw error;
            // json =
            // {"nodes":
            //      [{"asin": "B00AEVCRME", "name": "asd", "imUrl": "... .jpg", "price": 60.13, "numReviews": 36, "averageRating": 4.2, "helpfulFraction": 0.68, "brand": "CAD Audio", "salesRankCategory": "Musical Instruments", "salesRank": 38611, "group": 0, "component": 0, "hashColor": "#5feceb"}, ...]
            //  "links":
            //      [{"source": nodeId, "target": nodeId, "right": false, "left": true, "value": 1}, ...]}

            // convert the nodes to ProductNode
            this.net.nodes = json.nodes
                .map(n => new ProductNode(n.asin, n.name, n.imUrl, n.price, n.numReviews, n.averageRating, n.helpfulFraction, n.brand, n.salesRankCategory, n.salesRank, n.group, n.component, n.hashColor));
            this.net.links = json.links
                .map(l => new Link(this.net.nodes[l.source], this.net.nodes[l.target], l.left, l.right));
            // source and target of the link are now pointers to the nodes
            // instead of just numbers

            // detect and store the cliques
            let cm = {} // all cliques map
            this.net.nodes.forEach(n => {
                cm[n.group] = (cm[n.group] || [])
                cm[n.group].push(n)
            })
            let colId = 0
            for (let clique in cm){
                // we consider as clique only the ones with more that 1 element
                if (cm[clique].length > 1) {
                    this.net.cliques[clique] = {}
                    this.net.cliques[clique]["nodes"] = cm[clique]
                    this.net.cliques[clique]["color"] = d3.schemeCategory10[colId % 10]
                    colId += 1
                }
            }

            this.find_paths(this.net.nodes)

            this.hullg = this.svg.append("g");
            this.linkg = this.svg.append("g");
            this.nodeg = this.svg.append("g");

            let svgsize = this.svg.node().getBoundingClientRect()
            this.simulation = d3.forceSimulation()
                .force("link", d3.forceLink()) //.distance(() => 50)
                .force("charge", d3.forceManyBody())
                .force("center", d3.forceCenter(svgsize.width / 2, svgsize.height / 2))
                .velocityDecay(0.85)
                // regulate the shape of the whole cluster
                .force("x", d3.forceX().strength(.2))
                .force("y", d3.forceY().strength(.2))
                .force("repelForce", d3.forceManyBody().strength(-100))//.distanceMax(50).distanceMin(10));

            that.simulation.on("tick", ticked);
            function ticked() {
                that.linkg
                    .selectAll("line")
                    .attr("x1", (d) => d.source.x)
                    .attr("y1", (d) => d.source.y)
                    .attr("x2", (d) => d.target.x)
                    .attr("y2", (d) => d.target.y);

                that.nodeg.selectAll("circle")
                    .attr("cx", (d) => d.x)
                    .attr("cy", (d) => d.y);

                let hull = that.hullg.selectAll("path.hull")
                if (hull && !hull.empty()) {
                    hull.data(that.convexHulls())
                        .attr("d", that.drawHull);
                }
            }
            // this.computeNetwork(data);
            this.updateGraph(true);
            this.updatePriceBrush();

            // trigger a mouseover
            this.nodeg.select("circle:first-child").dispatch("mouseover")

            if (searchbox) {
                // give the autocompletion all the splitted names
                that.choices = Array.from(
                    new Set(
                        this.net.nodes.reduce((acc, node) => acc.concat(node.keywords), [])
                    )
                )
                new autoComplete({
                    selector: '#productSearchBox',
                    minChars: 1,
                    source: function (term, suggest) {
                        term = term.toLowerCase();
                        let matches = [];
                        for (let i = 0; i < that.choices.length; i++) {
                            if (that.choices[i].toLowerCase().indexOf(term) >= 0) {
                                matches.push(that.choices[i]);
                            }
                            if (matches.length >= 10) {
                                break
                            }
                        }
                        suggest(matches);
                    }
                });
            }

        });
    }

    updateGraph(show_opacity_change) {
        // store the context in a variable to access it in the functions
        let that = this

        // get only the nodes and the links to be shown
        let nodes_show = this.net.nodes.filter(node => node.toBeShown());
        let link_show = this.net.links.filter(link => link.toBeShown());

        if (show_opacity_change) {
            this.linkg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
            this.nodeg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
            this.hullg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
        }

        let link_selection = this.linkg
            .selectAll("line")
            .data(link_show)
            .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
            .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
        link_selection
            .enter()
            .append("line")
            .attr("class", "link")
            .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
            .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
        link_selection.exit().remove()

        let node_selection = this.nodeg
            .selectAll("circle")
            .data(nodes_show)

        let node_enter = node_selection
            .enter()
            .append("circle")
            .attr("id", (d) => d.asin) // give each node the id of its product
            .attr("class", "node")
            .attr("r", 5)
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.stroke(this.net))
            .on("mouseover", (d) => {
                // 1. show shortest path to best product
                let links = this.linkg.selectAll("line")
                let node = d
                while (node.pred != null) {
                    node.links[node.pred.id()].size = 3
                    node = node.pred
                }
                links.style("stroke", (d) => (d.size && d.size == 3) ? 'red' : '')

                // 2. show the details of the product
                if (this.productWindow){
                    this.productWindow.selectAll("*").remove()
                    d.appendTo(this.productWindow, null, () => this.updateFocus.call(this, d, true))
                }
                else{
                    this.tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    this.tooltip.html(d.createTooltip())
                        .style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.event.pageY - 28) + "px");
                }

                // 3. focus on the node
                this.updateFocus(d, false)
            })
            .on("mouseout", (d) => {
                this.tooltip.transition()
                .duration(500)
                .style("opacity", 0);

                let links = this.linkg.selectAll("line")
                this.net.links.forEach(l => l.size = 0)
                links.style("stroke", (d) => (d.size && d.size == 3) ? 'red' : '')
            })
            .call(d3.drag()
                .on("start", (d) => {
                    if (!d3.event.active) that.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (d) => {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })
                .on("end", (d) => {
                    if (!d3.event.active) that.simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }))

        // node_enter
        //     .style("opacity", 0)
        //     .transition().duration(500)
        //     .style("opacity", 1)

        let nodeUpdate = node_enter.merge(node_selection);
        nodeUpdate
            .attr("id", (d) => d.asin)
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.stroke(this.net))

        node_selection.exit().remove()

        this.simulation
            .nodes(nodes_show)

        this.simulation.force("link")
            .links(link_show)

        // increase the strength on the links between nodes belonging to the same cluster
        let str = 1
        this.simulation.force("linkForce",
                d3.forceLink(link_show.filter((l) => l.source.group == l.target.group))
                    .strength(str))


        // this.simulation.restart()
        this.simulation.alphaTarget(0.3).restart()

        let hull_data = this.convexHulls()
        let hull_selection = this.hullg
            .selectAll("path.hull")
            .data(hull_data)
        hull_selection.enter()
            .append("path")
            .attr("class", "hull")
            .attr("d", this.drawHull)
            // .style("fill", (d) => "blue")
            .style("fill", (d) => d.clique.color)
        hull_selection.exit().remove()

        // update the list of best products
        let rank = 1
        let maxrank = 5
        // clear the view
        this.bestProducts["view"].selectAll("*").remove()
        // scan the best products and show only the ones that are represented
        // in the graph
        this.bestProducts["nodes"].forEach(n => {
            if (n.toBeShown() && rank <= maxrank){
                if (rank != 1){
                    this.bestProducts["view"].append("hr")
                }
                n.appendTo(this.bestProducts["view"], rank, () => this.updateFocus.call(this, n, true))
                rank++
            }
        }
        )

    }

    convexHulls() {
        // update the hull of each clique
        let hulls = {};
        for (let clique in this.net.cliques) {
            if (this.net.cliques[clique].nodes.every(n => n.toBeShown())) { // only if we show all the graph
                hulls[clique] = hulls[clique] || []
                for (let n of this.net.cliques[clique].nodes) {
                    hulls[clique].push([n.x - this.off, n.y - this.off]);
                    hulls[clique].push([n.x - this.off, n.y + this.off]);
                    hulls[clique].push([n.x + this.off, n.y - this.off]);
                    hulls[clique].push([n.x + this.off, n.y + this.off]);
                }
            }
        }

        // create convex hulls
        let hullset = [];
        for (let clique in hulls) {
            // bind the hull to the respective group
            if (hulls[clique].length > 1)
                hullset.push({"clique": this.net.cliques[clique], "path": d3.polygonHull(hulls[clique])});
        }
        return hullset
    }

    find_paths(nodes) {
        // finds all the paths from the nodes to the node with the higher fan-in

        // Sort nodes by decreasing fan-in minus fan-out
        let best = nodes
            .filter(n => n instanceof ProductNode && n.toBeShown())
            .sort((a, b) => (b.incoming.length - b.neighbours.length) - (a.incoming.length - a.neighbours.length))

        nodes.forEach(n => [n.pred, n.dist, n.assigned] = [null, Infinity, false])

        let queue = []
        best.forEach(n => {
            if (!n.assigned) {
                queue.push(n)
                n.dist = 0
                this.bestProducts["nodes"].push(n)
            }
            while (queue.length > 0) {
                let u = queue.shift()
                u.assigned = true
                u.incoming.forEach(v => {
                    if (n.dist + 1 < v.dist) {
                        v.dist = n.dist + 1
                        v.pred = u
                        queue.push(v)
                    }
                })
            }
        })
    }

    filterProducts(keywords){
        // todo change (keywords will be an array)
        function bfs_show(nodes) {
            // the bfs is done considering only the product nodes

            // (unique) list of non-explored neighbours
            let neighbours = Array.from(
                new Set(
                    nodes
                        .reduce((acc, n) => acc.concat(n.neighbours.filter(n => !n.reachable)), [])));
            // set the neighbours as seen
            neighbours.forEach(n => n.reachable = true)
            if (neighbours.length > 0) {
                bfs_show(neighbours)
            }
        }

        if (keywords == ""){
            this.net.nodes.forEach(n => n.reachable = true)
        }
        else {
            // set show to true only the product nodes corresponding with the keyword
            let products = this.net.nodes.filter(n => {
                    //todo change for keywords = array
                    n.reachable = n.keywords.includes(keywords)
                    return n.reachable
                }
            )

            // mark a showable all the reachable nodes
            bfs_show(products)

            // show also the direct "parents"
            this.net.nodes.filter(n => n.reachable)
                .forEach(n => n.incoming.forEach(n => n.reachable=true))
        }

        this.updateGraph(true)
        this.updatePriceBrush()
    }

    updateFocus(newNode, zoom){
        // updates the focus: focus on newNode
        // newNode: node to focus on
        // zoom: boolean which indicates whether to zoom on that node

        // restore the color of the old focused one
        this.focusednode.attr("fill", (d) => d.fill())
        // focus on the new one
        this.focusednode = d3.select("circle#" + newNode.asin).attr("fill", "yellow")

        if (zoom) {
            let svgsize = this.svg.node().getBoundingClientRect()
            // zoom on the new node
            this.svg
                .transition()
                // .delay(500)
                .duration(2000)
                .call(this.zoom.transform, d3.zoomIdentity
                    .translate(svgsize.width / 2, svgsize.height / 2)
                    .scale(2)
                    .translate(-newNode.x, -newNode.y));
        }
    }

    updatePriceBrush(){
        let nodes = this.net.nodes.filter(node => node.reachable);

        let brushWidth = this.priceBrush.node().getBoundingClientRect().width
        let brushHeight = this.priceBrush.node().getBoundingClientRect().height
        let prices = nodes.map(n => n.price)
        let maxPrice = Math.max.apply(null, prices)
        maxPrice = Math.ceil(maxPrice/100)*100 // round to next multiple of 100

        let priceScale = d3.scaleLinear()
            .domain([0, maxPrice]) // min max price
            .rangeRound([0, brushWidth]);

        this.priceBrush.selectAll("g").remove()

        this.priceBrush.append("g").attr("id", "productPrices") // here we will show circles representing the prices

        // add small ticks to x axis
        this.priceBrush.append("g")
            .attr("opacity", 0.5)
            .attr("class", "axis axis--grid")
            .attr("transform", "translate(0," + this.brushHeight + ")")
            .call(d3.axisBottom(priceScale)
                .ticks(100)//(brushWidth, 12)
                .tickSize(-this.brushHeight)
                .tickFormat(() => null))
            .selectAll(".tick")
            .classed("tick--minor", (d) =>  d);

        // add wider ticks with label to x axis
        this.priceBrush.append("g")
            .attr("class", "axis axis--x")
            .call(d3.axisBottom(priceScale)
                    .ticks(10)//(brushWidth, 6)
                    .tickPadding(0)
                // .tickSize(10)
            )
            .attr("text-anchor", "middle")
            .selectAll("text")
            .attr("y", this.brushHeight/2)

        // add the rectangle to brush
        this.priceBrush.append("g")
            .attr("class", "brush")
            .attr("opacity", 0.5)
            .call(d3.brushX()
                .extent([[0, 0], [brushWidth, this.brushHeight]])
                .on("end", () => brushended()));

        let that = this
        function brushended() {
            if (!d3.event.sourceEvent) return; // Only transition after input.
            if (!d3.event.selection) return; // Ignore empty selections.
            let price_interval = d3.event.selection.map(priceScale.invert) // map pixels to prices
                // d1 = price_interval.map(p => round p?); // don't round

            that.net.nodes.forEach(n => n.in_price_interval = (price_interval[0]<n.price && price_interval[1]>n.price))

            that.updateGraph()
            // // If empty when rounded, use floor & ceil instead.
            // if (d0[0] >= d0[1]) {
            //     d0[0] = d3.timeDay.floor(d0[0]);
            //     d0[1] = d3.timeDay.offset(d1[0]);
            // }

        }

        let price_selection = this.priceBrush.select("g#productPrices")
            .selectAll("circle")
            .data(prices)
        let price_enter = price_selection
            .enter()
            .append("circle")
            .attr("r", 2)
            .attr("fill", "red")
            .attr("opacity", "0.7")
            .attr("cx", (d) => priceScale(d))
            .attr("cy", (d) => gaussianRandom(0, brushHeight))
        let price_update = price_enter.merge(price_selection);
        price_update
            .attr("cx", (d) => priceScale(d))
            .attr("cy", (d) => gaussianRandom(0, brushHeight))
        price_selection.exit().remove()
    }
}

class ProductNode {
    constructor(asin, name, imUrl, price, numReviews, averageRating, helpfulFraction, brand, salesRankCategory, salesRank, group, component, hashColor){
        this.asin = asin
        this.name = name
        this.group = group
        this.imUrl = imUrl
        this.price = price
        this.numReviews = numReviews
        this.averageRating = averageRating
        this.helpfulFraction = helpfulFraction
        this.brand = brand
        this.salesRankCategory = salesRankCategory
        this.salesRank = salesRank
        this.component = component
        this.hashColor = hashColor

        this.keywords = Array.from(
            new Set(
                this.name
                // remove ; , ( ) from keywords
                    .replace(/;|,|\(|\)/g, ' ')
                    .toLowerCase()
                    .split(" ")
                    .filter(s => s != "")
            )
        )

        // reachable and in_price_interval are the two conditions that need to be satisfied in order to show the product
        this.reachable = true
        this.in_price_interval = true

        this.neighbours = []; // list of directly reachable nodes
		this.incoming = []; // list of nodes that point towards this node
		this.links = {};

		this.fill_color = "red"
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return this.name
    }

    fill() {
        return this.fill_color
    }

    stroke(net){
        // change the stroke color if this node belongs to a clique and all the clique
        // is being shown
        // if (this.group in net.cliques && this.name.indexOf("RH2C")>=0)
        if (this.group in net.cliques && net.cliques[this.group].nodes.every(n => n.toBeShown()))
            return "black"
        return "#555"
    }

    toBeShown(){
        return this.reachable && this.in_price_interval
    }

    id() {
        return this.group+"|"+this.name;
    }

    link(){
        return "<a href='https://www.amazon.com/dp/"+ this.asin +"'> url </a>"
    }

    appendTo(div, rank, mouseenter){
        // Given a div (d3 selector), appends to the info about
        // the product to it
        // Call the passed mouseenter function when the cursor enters the div

        div = div.append("div")
            .style('cursor', 'pointer')
            .on("click", () => mouseenter())

        let rank_str = rank? rank + ". " : "" // if no rank is passed then append nothing
        div.append("h5")
            .append("a")
            .style("color", "inherit")
            .on("click", () => window.open('https://www.amazon.com/dp/'+ this.asin))
            .text(rank_str + this.name)
        div.append("img")
            .attr("src", this.imUrl)
            .attr("alt", "product image not available")
        div.append("h6")
            .text("Price: ")
            .append("label").text(this.price)
    }
}

class Link {
    constructor(source, target, left, right){
        this.source = source; // source node
        this.target = target; // target node
        this.left = left;     // direction of the arrow (bool)
        this.right = right;   // direction of the arrow (bool), the arrow may point in both directions
        this.size = 0;

        // add to each node the pointers to its out links (so that we can efficiently
        // do a BFS on the graph)
        if (this.right) {
            this.source.links[this.target.id()] = this
            this.source.neighbours.push(this.target)
            this.target.incoming.push(this.source)
        }
        if (this.left) {
            this.target.links[this.source.id()] = this
            this.target.neighbours.push(this.source)
            this.source.incoming.push(this.target)
        }
    }

    toBeShown() {
        // show this link only if both the nodes are to be shown
        return this.source.toBeShown() && this.target.toBeShown()
    }

    id(){
        let u = this.source.id(),
            v = this.target.id();
        return u + "|" + v;
    }
}


function gaussianRand() {
    let rand = 0;
    for (let i = 0; i < 6; i += 1) {
        rand += Math.random();
    }
    return rand / 6;
}
function gaussianRandom(start, end) {
    return Math.floor(start + gaussianRand() * (end - start + 1));
}