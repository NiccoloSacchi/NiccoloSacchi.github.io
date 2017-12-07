let p
let choices = []
let autocomp

// functions to manage search and autocompletion
function pageInit() {
    // drawCategoryGraph();
    p = new ProductGraph();
    p.drawGraph('product_graph', 'graph_1.json');

    autocomp = new autoComplete({
        selector: '#productSearchBox',
        minChars: 1,
        source: function (term, suggest) {
            term = term.toLowerCase();
            let matches = [];
            for (let i = 0; i < choices.length; i++) {
                if (choices[i].toLowerCase().indexOf(term)>=0) {
                    matches.push(choices[i]);
                }
                if (matches.length >= 10) {
                    break
                }
            }
            suggest(matches);
        }
    });
}

function filterProducts(keywords){
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

function find_paths(nodes) {
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

class ProductGraph {
    constructor() {
        // default initializations of the parameters (can be changed before calling the draw
        // method)
        this.width = "100%";     // svg width (computed afterwards)
        this.height = 600;     // svg height
        this.dr = 4;      // default point radius
        this.off = 15;    // cluster hull offset
        this.net = {"nodes":[], "links": [], cliques: {}};  // all nodes (either products or groups) and links
        // this.simulation; this.hullg; this.linkg; this.nodeg; these are set at runtime
        this.start_opacity = 1;

        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        this.curve = d3.line()
            .curve(d3.curveCardinalClosed.tension(.85));

        this.drawCluster = (d) => {
            return this.curve(d.path); // 0.8
        }
    }

    convexHulls() {
        // update the hull of each clique

        let hulls = {};
        for (let clique in this.net.cliques) {
            hulls[clique] = hulls[clique] || []
            for (let n of this.net.cliques[clique]){
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
                hullset.push({clique: this.net.cliques[clique], path: d3.polygonHull(hulls[clique])});
        }
        return hullset
    }

    drawGraph(svgId, file){ // e.g. ("product_graph", "graph.json")
        let that = this
        // select the svg
        let body = d3.select("body");
        let svg = body.select("#"+svgId)

        // clear the svg content
        svg.selectAll("*").remove();

        // set height and width, add zoom and drag
        svg.attr("width", this.width)
            .attr("height", this.height)
            .call(d3.zoom()
            //        .scaleExtent([1, 40])
            //        .translateExtent([[-100, -100], [width + 90, height + 100]])
                .on("zoom", () => {
                    svg.selectAll("g").attr("transform", d3.event.transform);
                })
        );

        // update the width with the computed one
        this.width = document.getElementById(svgId).clientWidth;

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
            .attr('fill', '#000');

        defs.append('marker')
            .attr('id', 'start-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', -14)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M10,-5L0,0L10,5')
            .attr('fill', '#000');

        // when drawing make the graph appear "smoothly"
        svg.attr("opacity", 1e-6)
            .transition()
            .duration(1000)
            .attr("opacity", this.start_opacity);

        d3.json("data/"+file, (error, json) => {
            if (error) throw error;
            // json =
            // {"nodes":
            //      [{"asin": "B00AEVCRME", "name": "asd", "imUrl": "... .jpg", "price": 60.13, "numReviews": 36, "averageRating": 4.2, "helpfulFraction": 0.68, "brand": "CAD Audio", "salesRankCategory": "Musical Instruments", "salesRank": 38611, "group": 0, "component": 0, "hashColor": "#5feceb"}, ...]
            //  "links":
            //      [{"source": nodeId, "target": nodeId, "right": false, "left": true, "value": 1}, ...]}

            // give the autocompletion all the splitted names
            choices = Array.from(
                new Set(
                    json.nodes
                        .map(i => i.name.split(" "))
                        .reduce((a, b) => a.concat(b)).map(i => i.toLowerCase())))

            // convert the nodes to ProductNode
            // let idx = 0 // HACK
            this.net.nodes = json.nodes
                .map(n => new ProductNode(n.asin, n.name, n.imUrl, n.price, n.numReviews, n.averageRating, n.helpfulFraction, n.brand, n.salesRankCategory, n.salesRank, n.group, n.component, n.hashColor));
            this.net.links = json.links
                .map(l => new Link(this.net.nodes[l.source], this.net.nodes[l.target], l.left, l.right));
            // source and target of the link are now pointers to the nodes
            // instead of just numbers

            // store the cliques
            let cm = {} // all cliques map
            this.net.nodes.forEach(n => {
                cm[n.group] = (cm[n.group] || [])
                cm[n.group].push(n)
            })
            for (let clique in cm)
                // we consider as clique only the ones with more that 1 element
                if (cm[clique].length > 1)
                    this.net.cliques[clique] = cm[clique]


            find_paths(p.net.nodes)

            this.hullg = svg.append("g");
            this.linkg = svg.append("g");
            this.nodeg = svg.append("g");

            this.simulation = d3.forceSimulation()
                .force("link", d3.forceLink()
//            .id((d) =>d.asin)
                )
                .force("charge", d3.forceManyBody())//.theta(1))
                .force("center", d3.forceCenter(this.width / 2, this.height / 2))
                // regulate the shape of the whole cluster
                .force("x", d3.forceX().strength(.2))
                .force("y", d3.forceY().strength(.1))
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
                        .attr("d", that.drawCluster);
                }
            }
            // this.computeNetwork(data);
            this.updateGraph();
        });
    }

    updateGraph() {
        // if (this.simulation) this.simulation.stop();

        // store the context in a variable to access it in the functions
        let that = this

        // get only the nodes and the links to be shown
        let nodes_show = this.net.nodes.filter(node => node.toBeShown());
        let link_show = this.net.links.filter(link => link.toBeShown());

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
            // .attr("stroke-width", (d) => Math.sqrt(d.value));
        link_selection.exit().remove()

        let node_selection = this.nodeg
            .selectAll("circle")
            .data(nodes_show)
        node_selection
            .enter()
            .append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .attr("fill", (d) =>d.fill())
            .on("mouseover", (d) => {
                this.tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                this.tooltip.html(d.createTooltip())
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");

                let url = document.getElementById("prodUrl")
                if (url)
                    url.innerHTML = d.link()

                // Show shortest path to best product
                let links = this.linkg.selectAll("line")
                let node = d
                while (node.pred != null) {
                    node.links[node.pred.id()].size = 3
                    node = node.pred
                }
                links.style("stroke", (d) => (d.size && d.size == 3) ? 'red' : '')
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
            .append("title")
            .text((d) => d.asin)
        node_selection.exit().remove()

        this.simulation
            .nodes(nodes_show)

        this.simulation.force("link")
            .links(link_show);

        // this.simulation.restart()
        this.simulation.alphaTarget(0.3).restart()

        let hull_data = this.convexHulls()
        let hull_selection = this.hullg
            .selectAll("path.hull")
            .data(hull_data)
        hull_selection.enter()
            .append("path")
            .attr("class", "hull")
            .attr("d", this.drawCluster)
            .style("fill", (d) => "blue")
        hull_selection.exit().remove()
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
        this.group = group
        this.component = component
        this.hashColor = hashColor
        this.group = group;

        this.show = true
        this.neighbours = []; // list of directly reachable nodes
		this.incoming = []; // list of nodes that point towards this node
		this.links = {};
        // this.group_data; set at runtime
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return this.name
    }

    fill() {
        return "red"
        // return this.hashColor
    }

    toBeShown(){
        if (this.group_data){
            // show if it belongs to an expanded, not hidden group and this node is not
            // hidden too
            return this.group_data.show && this.group_data.expanded && this.show
        }
        else{
            // otherwise show only if this node is not hidden
            return this.show
        }
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
        // do a DFS on the graph composed only by ProductNodes)
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