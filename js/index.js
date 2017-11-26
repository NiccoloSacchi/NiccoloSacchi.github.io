// function convert_map(map){
//     return Object.keys(map).map((name) => {
//         return {
//             'names': name.split(/ & |, /), // split the name into several categories
//             'children': convert_map(map[name][0]),
//             'count': map[name][1],
//             'isleaf': Object.keys(map[name][0]).length == 0 // has no children
//         }
//     });
// }

function scaleLinear(domain, codomain){
    return (x) => codomain[0] + (codomain[1]-codomain[0])*(x-domain[0])/(domain[1]-domain[0])
}

function fill(node){
    if (node.isleaf) {
        return "LightGreen";
    }

    if (node._children) { // collapsed
        return "lightsteelblue";
    }

    return "#fff" // expanded
}

function stroke(node){
    if (node.isleaf) {
        return "#006400";
    }
    return "blue";
}

// function resizeTree(){
//     let body = document.getElementsByTagName("body")[0];
//     let diameter = body.clientWidth;
//
//     let categories_graph = document.getElementsByTagName("categories_graph");
//     categories_graph.innerHTML = "";
//
//     var width = diameter;
//     var height = diameter;
//
//     let svg = d3.select("body").select("#categories_graph")
//         .attr("width", width )
//         .attr("height", height )
//         .append("g")
//         .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");
//
// }

let pubs;
d3.json("data/categories.json", function(data) {
    // let pubs = {"names": [""], "children": convert_map(data), 'count': 1, 'isleaf': false};
    pubs = data; // store the data in a "global" variable

    let body = document.getElementsByTagName("body")[0];
    let diameter = body.clientWidth;

    let margin = {top: 20, right: 120, bottom: 20, left: 120},
        width = diameter,
        height = diameter;

    let i = 0,
        duration = 350,
        root;

    let node_diameter = [2, 25];
    // let max_count = pubs["children"].map(e => e.count).reduce((e1, e2) => (e1>e2) ? e1 : e2);
    // let max_count = pubs["children"].map(e => e.count).reduce((e1, e2) => e1 + e2); pubs.count = max_count;
    let max_count = pubs["count"];
    let diameterScale = scaleLinear(
        [0, Math.sqrt(max_count)],  // domain (range of the count)
        [node_diameter[0], node_diameter[1]] // codomain (diameter of the nodes)
    );

    let tree = d3.layout.tree()
        .size([360, diameter / 2 - 80])
        .separation((a, b) => (a.parent == b.parent ? 1 : 10) / a.depth);

    let diagonal = d3.svg.diagonal.radial()
        .projection((d) => [d.y, d.x / 180 * Math.PI]);

    let svg = d3.select("body").select("#categories_graph")
        .attr("width", width )
        .attr("height", height )
        // .attr("preserveAspectRatio", "xMinYMin meet")
        // .attr("viewBox", "0 0 200 200")
        // //class to make it responsive
        // .classed("svg-content-responsive", true)
        .append("g")
        .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

    root = pubs;
    root.x0 = height / 2;
    root.y0 = 0;

    root.children.forEach(collapse); // start with all children collapsed
    update(root);

    d3.select(self.frameElement).style("height", "800px");

    function update(source) {

        // Compute the new tree layout.
        let nodes = tree.nodes(root),
            links = tree.links(nodes);

        // Normalize for fixed-depth.
        nodes.forEach((d) => d.y = d.depth * 120);

        // Update the nodes…
        let node = svg.selectAll("g.node")
            .data(nodes, (d) => d.id || (d.id = ++i));

        // Enter any new nodes at the parent's previous position.
        let nodeEnter = node.enter().append("g")
            .attr("class", "node")
            //.attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })
            .on("click", click);

        nodeEnter.append("circle")
            .style("stroke", (d) => stroke(d))
            .style("fill", (d) => fill(d));

        nodeEnter.append("text")
            .attr("text-anchor", (d) => d.x < 180? "start" : "end")
            // .attr("transform", (d) => { d.x < 180 ? "translate(0)" : "rotate(180)translate(-" + (d.name.length * 8.5)  + ")"})
            .style("fill-opacity", 1e-6)
            .html((d) =>
                d.names.map((name, i) =>
                    "<tspan x='0' dy='" + ((i==0)? (-(d.names.length-1)*1.1/2 + 0.35) : 1.1) + "em'>" +
                    name +
                    "</tspan>")
                    .join("")
            );

        // Transition nodes to their new position.
        let nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", (d) => "rotate(" + (d.x - 90) + ")translate(" + d.y + ")")

        nodeUpdate.select("circle")
            .attr("r", (d) => diameterScale(Math.sqrt(d.count)))
            .style("fill", (d) => fill(d));

        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .attr("text-anchor", (d) => d.x < 180? "start" : "end")
            .attr("transform", (d) => {
                let trans = diameterScale(Math.sqrt(d.count)) + 5;
                return d.x < 180 ? "translate(0)translate(" + trans + ")" : "rotate(180)translate(" + -trans + ")"
            });

        // TODO: appropriate transform
        let nodeExit = node.exit().transition()
            .duration(duration)
            //.attr("transform", function(d) { return "diagonal(" + source.y + "," + source.x + ")"; })
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // Update the links…
        let link = svg.selectAll("path.link")
            .data(links, (d) => d.target.id);

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", (d) => {
                let o = {x: source.x0, y: source.y0};
                return diagonal({source: o, target: o});
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", (d) => {
                let o = {x: source.x, y: source.y};
                return diagonal({source: o, target: o});
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Toggle children on click.
    function click(d) {
        if (d.isleaf){
            return
        }
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }

        update(d);
    }

    // Collapse nodes
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }
    //
    // resizeTree();
    // window.addEventListener("resize", resizeTree);
});

