export class ProductGraph {
    constructor() {
        // default initializations of the parameters (can be changed to modify the graph)
        this.width = "100%";     // svg width
        this.height = "100%";     // svg height
        this.off = 10;    // cluster hull offset
        this.net = {"nodes":[], "links": [], "cliques": {}};  // all nodes (either products or groups) and links
        this.choices = [];

        // this.simulation; this.hullg; this.linkg; this.nodeg; these are set at runtime
        // this.tooltip = d3.select("body").append("div")
        //     .attr("class", "tooltip")
        //     .style("opacity", 0);

        this.drawHull = (d) =>
            d3.line().curve(d3.curveCardinalClosed.tension(.85))(d.path); // 0.8
    }

    drawGraph(divId, file, searchbox, productWindow){
        // divId: id of the div in which to draw the search bar and the graph
        // file: path to the file containing the graph
        // searchbox: boolean to indicate whether draw a searchbox
        // productWindow: boolean to indicate whether reserve part of the div
        //                the details of the mouse-overed product

        let that = this

        // select the div
        let div = d3.select("#"+divId);
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

        let graph_view = div
        if (productWindow){
            // then create a table, on the left we show the graph
            // on the right the details of the product
            let row = div.append("table")
                .attr("class", "product_table")
                .attr("width", "100%")
                .attr("height", "100%")
                .append("tr")
            graph_view = row.append("td").style("padding", 0)
            let prodWindow = row.append("td").attr("width", 200)
            this.productWindow = {
                "title": prodWindow.append("h5"),
                "image": prodWindow.append("img")
                    .attr("width", "100%")
                    .attr("heigth", 100),
                "price": prodWindow.append("h6")
                    .text("Price: ")
                    .append("label")
            }
        }

        // append the svg to draw the graph
        let svg = graph_view.append("svg")
            .attr("class", "product_graph")
            // set height and width, add zoom and drag
            .attr("width", this.width)
            .attr("height", this.height)
            .call(d3.zoom()
            //        .scaleExtent([1, 40])
            //        .translateExtent([[-100, -100], [width + 90, height + 100]])
                .on("zoom", () => {
                    svg.selectAll("g").attr("transform", d3.event.transform);
                })
            );

        // update the width with the computed one
        let rect = svg.node().getBoundingClientRect()
        this.width = rect.width
        this.height = rect.height

        // define arrow markers for graph links (directed edges)
        let defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 18)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('stroke', 'black')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 3)
            .attr('fill', 'none')

        defs.append('marker')
            .attr('id', 'start-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', -14)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M10,-5L0,0L10,5')
            .attr('stroke', 'black')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 3)
            .attr('fill', 'none')

        // when drawing make the graph appear "smoothly"
        svg.attr("opacity", 1e-6)
            .transition()
            .duration(1000)
            .attr("opacity", 1);

        d3.json("data/"+file, (error, json) => {
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

            this.hullg = svg.append("g");
            this.linkg = svg.append("g");
            this.nodeg = svg.append("g");

            this.simulation = d3.forceSimulation()
                .force("link", d3.forceLink()) //.distance(() => 50)
                .force("charge", d3.forceManyBody())
                .force("center", d3.forceCenter(this.width / 2, this.height / 2))
                .velocityDecay(0.85)
                // regulate the shape of the whole cluster
                .force("x", d3.forceX().strength(.2))
                .force("y", d3.forceY().strength(.2))
                .force("repelForce", d3.forceManyBody().strength(-50))//.distanceMax(50).distanceMin(10));

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
            this.updateGraph();

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

    updateGraph() {
        // store the context in a variable to access it in the functions
        let that = this

        // get only the nodes and the links to be shown
        let nodes_show = this.net.nodes.filter(node => node.toBeShown());
        let link_show = this.net.links.filter(link => link.toBeShown());

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
            .attr("class", "node")
            .attr("r", 5)
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.group in this.net.cliques ? "black" : "#555")
            .on("mouseover", (d) => {
                // // 1. show the tooltip
                // this.tooltip.transition()
                //     .duration(200)
                //     .style("opacity", .9);
                // this.tooltip.html(d.createTooltip())
                //     .style("left", (d3.event.pageX) + "px")
                //     .style("top", (d3.event.pageY - 28) + "px");

                // 2. show shortest path to best product
                let links = this.linkg.selectAll("line")
                let node = d
                while (node.pred != null) {
                    node.links[node.pred.id()].size = 3
                    node = node.pred
                }
                links.style("stroke", (d) => (d.size && d.size == 3) ? 'red' : '')

                // 3. show the details of the product
                if (this.productWindow){
                    this.productWindow["title"].text(d.name)
                    this.productWindow["image"]
                        .attr("src", d.imUrl)
                        .attr("alt", "product image")
                    this.productWindow["price"].text(d.price)
                }
            })
            .on("mouseout", (d) => {
                // this.tooltip.transition()
                // .duration(500)
                // .style("opacity", 0);

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
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.group in this.net.cliques ? "black" : "#555")

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

        // trigger a mouseover
        this.nodeg.select("circle:first-child").dispatch("mouseover")
    }

    convexHulls() {
        // update the hull of each clique
        let hulls = {};
        for (let clique in this.net.cliques) {
            hulls[clique] = hulls[clique] || []
            for (let n of this.net.cliques[clique].nodes){
                if (n.toBeShown()) {
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
            .filter(a => a instanceof ProductNode && a.show)
            .sort((a, b) => (b.incoming.length - b.neighbours.length) - (a.incoming.length - a.neighbours.length))

        nodes.forEach(n => [n.pred, n.dist, n.assigned] = [null, Infinity, false])

        let queue = []
        best.forEach(n => {
            if (!n.assigned) {
                queue.push(n)
                n.dist = 0
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

        // set show to true only the product nodes corresponding with the keyword
        let products = this.net.nodes.filter(n => {
            //todo change for keywords = array
                n.show = n.keywords.includes(keywords)
                return n.show
            }
        )

        // mark a showable all the reachable nodes
        dfs_show(products)

        this.updateGraph()
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

        this.keywords = this.name
            .toLowerCase()
            .split(" ")
            // remove ; , ( ) from keywords
            .map(s => s.replace(/;|,|\(|\)/g, ''))

        this.show = true
        this.neighbours = []; // list of directly reachable nodes
		this.incoming = []; // list of nodes that point towards this node
		this.links = {};
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return this.name
    }

    fill() {
        return "red"
    }

    toBeShown(){
        return this.show
    }

    id() {
        return this.group+"|"+this.name;
    }

    link(){
        return "<a href='https://www.amazon.com/dp/"+ this.asin +"'> url </a>"
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