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

// attach the .equals method to Array's prototype to call it on any array
ArrayEquals = (array1, array2) => {
    // if the other array is a falsy value, return
    if (!array1 || !array2)
        return false;

    // compare lengths - can save a lot of time
    if (array1.length != array2.length)
        return false;

    for (let i = 0, l=array1.length; i < l; i++) {
        // Check if we have nested arrays
        if (array1[i] instanceof Array && array2[i] instanceof Array) {
            // recurse into the nested arrays
            if (!ArrayEquals(array1[i], array2[i]))
                return false;
        }
        else if (array1[i] != array2[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
};

// todo: this function is present in d3
function scaleLinear(domain, codomain){
    return (x) => codomain[0] + (codomain[1]-codomain[0])*(x-domain[0])/(domain[1]-domain[0])
}

function fill_category(node){
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

let pubs;
d3.json("data/categories.json", function(data) {
    // let pubs = {"names": [""], "children": convert_map(data), 'count': 1, 'isleaf': false};
    pubs = data; // store the data in a "global" variable

    // let body = document.getElementsByClassName("posts-list")[0];
    // let diameter = body.clientWidth;
    let width = document.getElementsByTagName("article")[0].clientWidth;
    let height = 600;

    let diameter = height;

    // let margin = {top: 20, right: 120, bottom: 20, left: 120},
        // width = diameter,
        // height = diameter;

    let i = 0,
        duration = 350,
        roots=[];

    let node_diameter = [2, 25];
    // let max_count = pubs["children"].map(e => e.count).reduce((e1, e2) => (e1>e2) ? e1 : e2);
    // let max_count = pubs["children"].map(e => e.count).reduce((e1, e2) => e1 + e2); pubs.count = max_count;
    let max_count = pubs["count"];
    let diameterScale = scaleLinear(
        [0, Math.sqrt(max_count)],  // domain (range of the count)
        [node_diameter[0], node_diameter[1]] // codomain (diameter of the nodes)
    );

    let degrees = 300;
    let degrees_half = degrees/2;
    let tree = d3.layout.tree()
        .size([degrees, diameter / 2 - 80])
        .separation((a, b) => (a.parent == b.parent ? 1 : 10) / a.depth);

    let diagonal = d3.svg.diagonal.radial()
        .projection((d) => [d.y, d.x / 180 * Math.PI]);

    let svg = d3.select("body").select("#categories_graph")
        .attr("width", width )
        .attr("height", height )
        .append("g")
        .attr("transform", "translate(" +  width / 2 + "," + height / 2 + ")rotate(" + (360-degrees)/2 +")");

    //create the tooltip that will be show on mouse over the nodes
    let tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    let curr_root = pubs;
    roots.push(curr_root);
    curr_root.x0 = height / 2;
    curr_root.y0 = 0;

    curr_root.children.forEach(collapse); // start with all children collapsed
    update(curr_root);

    d3.select(self.frameElement).style("height", "800px");

    function update(source) {
        let curr_root = roots[roots.length-1];

        // Compute the new tree layout.
        let nodes = tree.nodes(curr_root),
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
            .on("click", click)
	    // show the tooltip
            .on("mouseover", (d) => {
                tooltip
                    .transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip
                    .html(
                        "<span><b>Number of products: </b>" + d.count.toLocaleString() + "</span>")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", (d) => {
                tooltip
                    .transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        nodeEnter.append("circle")
            .style("stroke", (d) => stroke(d))
            .style("fill", (d) => fill_category(d));

        nodeEnter.append("text")
            .attr("text-anchor", (d) => d.x < degrees_half? "start" : "end")
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
            .attr("transform", (d) => "rotate(" + (d.x - 90) + ")translate(" + d.y + ")");

        nodeUpdate.select("circle")
            .attr("r", (d) => diameterScale(Math.sqrt(d.count)))
            .style("fill", (d) => fill_category(d))
            // for the node in the middle show a "back" image
            .filter((d) =>
                ArrayEquals(d.names, curr_root.names) && !ArrayEquals(d.names, ["Amazon"]))
            .style("fill", "")
            .attr("fill", "url(#image)");

        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .attr("class", "") // remove all previous classes (if it was a root before...)
            .attr("text-anchor", (d) => (d.x < degrees_half)? "start" : "end")
            .attr("transform", (d) => {
                let trans = diameterScale(Math.sqrt(d.count)) + 5;
                return d.x < degrees_half ? "translate(0)translate(" + trans + ")" : "rotate(180)translate(" + -trans + ")"
            })
            .filter((d) =>
                // the root note should be represented in the middle, bigger and not rotated
                ArrayEquals(d.names, curr_root.names)
            )
            .attr("transform", (d) => "rotate(-90)translate(0," + (diameterScale(Math.sqrt(d.count))+10*d.names.length) +")")
            .attr("text-anchor", "middle")
            .attr("class", "root_node");

        // TODO: appropriate transform
        let nodeExit = node.exit().transition()
            .duration(duration)
            // .attr("transform", function(d) { return "diagonal(" + source.y + "," + source.x + ")"; })
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
            if (roots.length == 1){
                // don't collapse the root "amazon"
                return
            }
            // collapse
            d._children = d.children;
            d.children = null;

            // restore the "parent" root
            roots.pop();

        } else {
            // expand
            d.children = d._children;
            d._children = null;

            // this node must be the root now
            let curr_root = roots[roots.length-1];
            roots.push(curr_root.children.find(node => ArrayEquals(node.names, d.names)))
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
});

