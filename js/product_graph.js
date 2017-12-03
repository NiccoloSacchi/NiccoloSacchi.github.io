class ProductGraph {
    constructor() {
        // default initializations of the parameters (can be changed before calling the draw
        // method)
        this.width = "100%";     // svg width (computed afterwards)
        this.height = 600;     // svg height
        this.dr = 4;      // default point radius
        this.off = 15;    // cluster hull offset
        this.net = {"nodes":[], "links": []};  // all nodes (either products or groups) and links
        // this.force; this.hullg; this.linkg; this.nodeg; these are set at runtime
        this.start_opacity = 1;

        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        this.curve = d3.svg.line()
            .interpolate("cardinal-closed")
            .tension(.85);

        this.drawCluster = (d) => {
            return this.curve(d.path); // 0.8
        }
    }

    computeNetwork(data) {
        // compute the network
        let gm = {},    // group map (build groups while scanning nodes)
            nodes = [], // all nodes (product + group)
            links = []; // all links (between products and/or groups)

        // assign the nodes to the respective group
        for (let node of data.nodes) {
            let groupId = node.group; // get group id

            if (!gm[groupId]) {
                // first time you see this group
                gm[groupId] = new GroupNode(groupId);
                // add the group to the list of nodes
                nodes.push(gm[groupId]);
            }
            let group = gm[groupId];
            // add this node to its group
            group.nodes.push(node);

            // add to the product node the pointer to its group node
            node.group_data = group;

            // add the product node to the list of nodes
            nodes.push(node);
        }

        // remove the groups with only one node and mark them as expanded
        // We always want to show directly the inner product
        nodes = nodes.filter(group => {
            if (group instanceof GroupNode) {
                group.expanded = (group.nodes.length == 1)
                return !group.expanded // filter out the expanded groups
            }
            return true
        });

        // determine links and compute link_count (#links that point outside the group)
        for (let link of data.links) {
            // link.source and link.target are ProductNodes
            let source = link.source,
                target = link.target,
                s, t;

            // add the link between the two ProductNodes
            s = source;
            t = target;
            links.push(new Link(s, t, link.left, link.right))

            // recall: if now a group is expanded then is because we don't wanna show it
            // add the link between the two GroupNodes (if both are in 'nodes' are are different)
            if (!source.group_data.expanded && !source.group_data.expanded && source.group!=target.group) {
                s = source.group_data
                t = target.group_data
                links.push(new Link(s, t, link.left, link.right))
            }

            if (!target.group_data.expanded) {
                s = source
                t = target.group_data
                links.push(new Link(s, t, link.left, link.right))
            }

            if (!source.group_data.expanded) {
                s = source.group_data;
                t = target;
                links.push(new Link(s, t, link.left, link.right))
            }
        }
        this.net = {nodes: nodes, links: links};
    }

    updateNetwork(clicked){
        // update the network after the click on a node (or an hull)
        // clicked = clicked node (either GroupNode or ProductNode)
        // returns true if the network changed
        if (clicked.expandable()) {
            // clicked is an expandable GroupNode
            clicked.expanded = true;
            // expand the product nodes near the group node
            clicked.nodes.forEach(node => {
                node.x = clicked.x + Math.random();
                node.y = clicked.y + Math.random();})
            return true
        }
        if (clicked.collapsible()){
            // clicked is a collapsible ProductNode
            clicked.group_data.expanded = false;
            // collapse the product node in a group node which will be shown close
            clicked.group_data.x =
                clicked.group_data.nodes
                    .map(node => node.x)
                    .reduce((x1, x2) => x1+x2)/clicked.group_data.nodes.length;
            clicked.group_data.y =
                clicked.group_data.nodes
                    .map(node => node.y)
                    .reduce((y1, y2) => y1+y2)/clicked.group_data.nodes.length;
            return true
        }
        // if I can not collapse nor expand then the network didn't changed
        return false
    }

    convexHulls() {
        // constructs the shadows for the "opened" clusters
        let hulls = {};

        for (let n of this.net.nodes) {
            if (n instanceof ProductNode){
                if (n.group_data.nodes.length != 1 && n.group_data.expanded) {
                    // if this node belongs to a group with more than one node
                    // the draw the hull
                    let i = n.group,
                        l = hulls[i] || (hulls[i] = []);
                    l.push([n.x - this.off, n.y - this.off]);
                    l.push([n.x - this.off, n.y + this.off]);
                    l.push([n.x + this.off, n.y - this.off]);
                    l.push([n.x + this.off, n.y + this.off]);
                }
            }
        }

        // create convex hulls
        let hullset = [];
        for (let i in hulls) {
            hullset.push({group: i, path: d3.geom.hull(hulls[i])});
        }

        return hullset;
    }

    draw(svgId, file){ // e.g. ("product_graph", "graph.json")
        // select the svg
        let body = d3.select("body");
        let svg = body.select("#"+svgId)

        // clear the svg content
        svg.selectAll("*").remove();

        // set height and width, add zoom and drag
        svg.attr("width", this.width)
            .attr("height", this.height)
            .call(d3.behavior.zoom().on("zoom", () => {
                svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
            }));

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
            //      [{"name": nodeName, "group": groupId}, ...]
            //  "links":
            //      [{"source": nodeId, "target": nodeId, "right": false, "left": true, "value": 1}, ...]}
            let data = {"nodes":[], "links":[]};
            data.nodes = json.nodes.map(n => new ProductNode(n.name, n.group));
            data.links = json.links;

            for (let link of data.links) {
                // source and target of the link are now pointers to the structure
                // of a node instead of just numbers
                link.source = data.nodes[link.source];
                link.target = data.nodes[link.target];
            }

            this.hullg = svg.append("g");
            this.linkg = svg.append("g");
            this.nodeg = svg.append("g");

            this.computeNetwork(data);
            this.updateGraph();
        });
    }

    updateGraph() {
        if (this.force) this.force.stop();

        // get only the nodes and the links to be shown
        let nodes_show = this.net.nodes.filter(node => node.toBeShown());
        let link_show = this.net.links.filter(link => link.toBeShown());


        this.force = d3.layout.force()
            .nodes(nodes_show)
            .links(link_show)
            .size([this.width, this.height])
            .linkDistance((l, i) => {
                // let n1 = l.source, n2 = l.target;
                // // larger distance for bigger groups:
                // // both between single nodes and _other_ groups (where size of own node group still counts),
                // // and between two group nodes.
                // //
                // // reduce distance for groups with very few outer links,
                // // again both in expanded and grouped form, i.e. between individual nodes of a group and
                // // nodes of another group or other group node or between two group nodes.
                // //
                // // The latter was done to keep the single-link groups ('blue', rose, ...) close.
                // return 30 +
                //     Math.min(20 * Math.min((n1.size || (n1.group != n2.group ? n1.group_data.size : 0)),
                //         (n2.size || (n1.group != n2.group ? n2.group_data.size : 0))),
                //         -30 +
                //         30 * Math.min((n1.link_count || (n1.group != n2.group ? n1.group_data.link_count : 0)),
                //         (n2.link_count || (n1.group != n2.group ? n2.group_data.link_count : 0))),
                //         100);
                // //return 150;
                let n1 = l.source, n2 = l.target;
                return n1.group == n2.group ? 10:20
            })
            .linkStrength(() => 1)
            .gravity(0.3)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
            .charge(-600)    // (node repulsion) ... charge is important to turn single-linked groups to the outside
            .friction(0.7)   // friction adjusted to get dampened display: less bouncy bouncy ball
            .start();

        this.hullg.selectAll("path.hull").remove();
        let hull = this.hullg.selectAll("path.hull")
            .data(this.convexHulls())
            .enter().append("path")
            .attr("class", "hull")
            .attr("d", this.drawCluster)
            .style("fill", (d) => "blue")//.group))
            .on("click", (d) => {
                // convert the hull to a ProductNode in the hull
                let clicked = this.net.nodes.find(node =>
                    (node instanceof ProductNode) && (node.group==d.group)
                )

                if (this.updateNetwork(clicked)) {
                    this.updateGraph();
                }
            });

        let link = this.linkg.selectAll("line.link").data(link_show, (l) => l.id())
        link.exit().remove();
        link.enter().append("line")
            .attr("class", "link")
            .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
            .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y)
            .style("stroke-width", (d) => 1 || d.size || 1);

        let node = this.nodeg.selectAll("circle.node")
            .data(nodes_show, (n) => n.id())
        node.exit().remove();
        node.enter().append("circle")
            .attr("class", (d) => "node" + (d instanceof GroupNode ? "" : " leaf"))
            .attr("r", (d) =>  d instanceof GroupNode ? d.nodes.length + this.dr : this.dr + 1)
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y)
            .style("fill", (d) => d.fill())//.group))
            .on("click", (d) => {
                if (this.updateNetwork(d))
                {
                    // it the network updated the update also the graph
                    this.updateGraph();
                }
            })
            .on("mouseover", (d) => {
                this.tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                this.tooltip.html(d.createTooltip())
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", (d) => {
                this.tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // node.call(this.force.drag);

        this.force.on("tick", () => {
            if (!hull.empty()) {
                hull.data(this.convexHulls())
                    .attr("d", this.drawCluster);
            }

            link.attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y)

            node.attr("cx", (d) => d.x)
                .attr("cy", (d) => d.y);
        });
    }
}


class Node{
    // represent a node to be drawn (can be either a cluster of products or a single product)
    // is an "interface" for ProductNode and ClusterNode (but there are no interfaces in ECMA5...)

    constructor(group){
        // todo show could be only a parameter of a GroupNode
        this.group = group;
        this.show = true; // you will remove some nodes from the graph (simply don't show them)
        // this.index;
        // this.weight;
        // this.x;
        // this.y;
    }

    // functions that every node has to implement
    expandable(){
    }
    collapsible(){
    }
    createTooltip() {
    }
    fill() {
    }
    toBeShown() {
    }
    id(){
    }
}

class ProductNode extends Node{
    constructor(name, group){
        super(group);
        this.name = name;
        // this.group_data; set at runtime
    }

    expandable(){
        // a ProductNode is not expandible
        return false
    }

    collapsible(){
        // a ProductNode is collapsible in the GroupNode only if the latter contains
        // at least two ProductNode
        return this.group_data.nodes.length>1
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return this.name
    }

    fill() {
        return "red"
    }

    toBeShown(){
        // a ProductNode is shown if (this.group_data.expanded && this.show), i.e.
        // -this.group_data.expanded: the relative group is expanded
        // -this.show: you want effectively to show the node (maybe the user is not interested
        // in seeing this product)
        return this.group_data.expanded && this.show
    }

    id() {
        return this.group+"|"+this.name;
    }
}

class GroupNode extends Node{
    constructor(group){
        super(group);
        this.link_count = 1;
        this.nodes = [];
        this.expanded = false;
    }

    expandable(){
        // a GroupNode is always expandable in the containing ProductNodes
        return true
    }

    collapsible(){
        // a GroupNode in not collapsible
        return false
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return "<b>Number of elements:</b> " + this.nodes.length
    }

    fill() {
        return "blue"
    }

    toBeShown(){
        // the group is shown only if not expanded
        return !this.expanded && this.show
    }

    id() {
        return this.group;
    };
}

class Link {
    constructor(source, target, left, right){
        this.source = source; // source node
        this.target = target; // target node
        this.left = left;     // direction of the arrow (bool)
        this.right = right;   // direction of the arrow (bool), the arrow may point in both directions
        this.size = 0;
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