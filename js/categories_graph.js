export class CategoryGraph {
    constructor(){
    }

    drawGraph(asd, file){
        let pubs;
        let that = this;

        d3.json(file, (error, data) => {
            if (error) throw error;

            // let pubs = {"names": [""], "children": convert_map(data), 'count': 1, 'isleaf': false};
            pubs = data; // store the data in a "global" variable

            // let margin = {top: 20, right: 120, bottom: 20, left: 120},

            let height = 530;
            let width; // width will be computer after
            // let diameter = height;

            let i = 0,
                duration = 350,
                roots = [];

            let node_diameter = [2, 25];
            let max_count = pubs["count"];
            let diameterScale = d3.scaleLinear()
                .domain([0, Math.sqrt(max_count)])
                .range([node_diameter[0], node_diameter[1]]);

            let svg = d3.select("body").select("#categories_graph")
                .attr("width", "100%")
                .attr("height", height)
                .append("g")

            width = document.getElementById("categories_graph").clientWidth;
            svg.attr("transform", () => "translate(" + width / 2 + "," + (height / 2) + ")");

            let degrees = 2*Math.PI;
            let degrees_half = degrees / 2;
            let treemap = d3.tree()
                .size([degrees, width])
                .separation((a, b) => (a.parent == b.parent ? 1 : 10) / a.depth);

            //create the tooltip that will be show on mouse over the nodes
            let tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            let curr_root =  d3.hierarchy(pubs, (d) => d.children);
            roots.push(curr_root);
            curr_root.x0 = height / 2;
            curr_root.y0 = 0;

            curr_root.children.forEach(collapse); // start with all children collapsed
            update(curr_root); // update the graph
            appendToList(curr_root); // update the list

            function update(source) {
                let curr_root = roots[roots.length - 1];

                // Assign the x and y position to the nodes
                let root = treemap(curr_root);

                // Compute the new tree layout.
                let nodes = root.descendants(),
                    links = root.links()

                // Normalize for fixed-depth.
                nodes.forEach((d) => d.y = d == curr_root ? 0 : 100);

                // ****************** Nodes section ***************************
                // Update the nodes...
                let node = svg.selectAll('g.node')
                    .data(nodes, (d) => d.id || (d.id = ++i));
                let nodeEnter = node.enter().append('g')
                    .attr('cursor', 'pointer')
                    .attr('class', 'node')
                    .attr("transform", (d) => "translate(" + radialPoint(source.x0, source.y0) + ")")
                    .on('click', click)
                    // show the tooltip
                    .on("mouseover", (d) => {
                        tooltip
                            .transition()
                            .duration(200)
                            .style("opacity", .9);
                        tooltip
                            .html(
                                "<span><b>Number of products: </b>" + d.data.count.toLocaleString() + "</span>")
                            .style("left", (d3.event.pageX) + "px")
                            .style("top", (d3.event.pageY - 28) + "px");
                    })
                    .on("mouseout", (d) => {
                        tooltip
                            .transition()
                            .duration(500)
                            .style("opacity", 0);
                    });

                // Add Circle for the nodes
                nodeEnter.append("circle")
                    .attr('r', 1e-6)
                    .style("stroke", (d) => that.stroke(d))
                    .style("fill", (d) => that.fill_category(d));

                // Add labels for the nodes
                nodeEnter.append("text")
                    .attr("dy", "0.31em")
                    .attr("x", (d) => d.x < degrees_half ? 6 : -6)
                    .html((d) => {
                            let names = d.data.names
                            return names.map((name, i) =>
                                "<tspan x='0' dy='" + ((i == 0) ? (-(names.length - 1) * 1.1 / 2 + 0.35) : 1.1) + "em'>" +
                                name +
                                "</tspan>")
                                .join("")
                        }
                    );

                // UPDATE
                let nodeUpdate = nodeEnter.merge(node);

                // Transition to the proper position for the node
                nodeUpdate.transition()
                    .duration(duration)
                    .attr("transform", (d) => "translate(" + radialPoint(d.x, d.y) + ")");

                // Update the node attributes and style
                nodeUpdate.select("circle")
                    .attr("r", (d) => diameterScale(Math.sqrt(d.data.count)))
                    .style("fill", (d) => that.fill_category(d))
                    // for the node in the middle show a "back" image
                    .filter((d) =>
                        ArrayEquals(d.data.names, curr_root.data.names) && !ArrayEquals(d.data.names, ["Amazon"]))
                    .style("fill", "")
                    .attr("fill", "url(#image)");

                // update the text on the new root node
                nodeUpdate.select("text")
                    .attr("text-anchor", (d) => d.x < degrees_half ? "start" : "end")
                    .attr("transform", (d) =>
                        "rotate(" + (d.x < degrees_half ? d.x - degrees_half / 2 : d.x + degrees_half / 2) * 180 / degrees_half + ")" +
                        "translate(" + (d.x < degrees_half ? 15 : -15) +")")
                    // .style("fill-opacity", 1)
                    .attr("class", "") // remove all previous classes (if it was a root before...)
                    .filter((d) =>
                        // the root note should be represented in the middle, bigger and not rotated
                        ArrayEquals(d.data.names, curr_root.data.names)
                    )
                    .attr("transform", (d) => "rotate(0)translate(0," + (diameterScale(Math.sqrt(d.data.count)) + 10 * d.data.names.length) + ")") //todo?
                    .attr("text-anchor", "middle")
                    .attr("class", "root_node")
                // .attr('cursor', 'pointer'); todo ?

                // Remove any exiting nodes
                let nodeExit = node.exit().transition()
                    .duration(duration)
                    .attr("transform", (d) => "translate(" + radialPoint(source.x, source.y) + ")")
                    .remove();

                nodeExit.select("circle")
                    .attr("r", 1e-6);

                nodeExit.select("text")
                    .style("fill-opacity", 1e-6);

                // ****************** links section ***************************

                // Update the links…
                let link = svg.selectAll("path.link")
                    .data(links, (d) =>  d.id);

                // Enter any new links at the parent's previous position.
                let linkEnter = link.enter().insert('path', "g")
                    .attr("class", "link")
                    .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))

                // UPDATE
                let linkUpdate = linkEnter.merge(link)

                // Transition back to the parent element position
                linkUpdate.transition()
                    .duration(duration)
                    .attr("d", d3.linkRadial().angle((d) => d.x).radius((d) => d.y))

                // Remove any exiting links
                let linkExit = link.exit().transition()
                    .duration(duration)
                    .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))
                    .remove();

                // Stash the old positions for transition.
                nodes.forEach((d) => {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }

            // Toggle children on click.
            function click(d) {
                if (d.data.isleaf) {
                    return
                }

                if (d.children) {
                    if (roots.length == 1) {
                        // don't collapse the root "amazon"
                        return
                    }

                    // collapse tree
                    d._children = d.children;
                    d.children = null;

                    // restore the "parent" root
                    roots.pop();

                    // remove the last element from the list
                    let list = document.getElementById("category_view")
                    list.removeChild(list.childNodes[list.childNodes.length - 1])
                } else {
                    // expand tree
                    d.children = d._children;
                    d._children = null;

                    // this node must be the root now
                    // let curr_root = roots[roots.length-1];
                    // let new_root = curr_root.children.find(node => ArrayEquals(node.names, d.names))
                    roots.push(d)

                    // show in the list the parent category
                    appendToList(d)
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

            function appendToList(d) {
                let parent = document.createElement("p");
                let category_name = d.data.names.join(" & ")
                parent.appendChild(document.createTextNode(category_name));
                parent.addEventListener("click", () => {
                    // delete all the roots up to this one
                    roots = roots.slice(0, roots.indexOf(d))
                    collapse(d);

                    let list = document.getElementById("category_view")
                    while (list.childNodes[list.childNodes.length - 1].innerText != category_name) {
                        list.removeChild(list.childNodes[list.childNodes.length - 1])
                    }
                    list.removeChild(list.childNodes[list.childNodes.length - 1])

                    click(d)
                });
                document.getElementById("category_view").appendChild(parent)
            }

            function radialPoint(x, y) {
                return [(y = +y) * Math.cos(x -= degrees_half / 2), y * Math.sin(x)];
            }
        });
    }

    fill_category(node) {
        if (node.isleaf) {
            return "LightGreen";
        }

        if (node._children) { // collapsed
            return "lightsteelblue";
        }

        return "#fff" // expanded
    }

    stroke(node) {
        if (node.isleaf) {
            return "#006400";
        }
        return "blue";
    }

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
}

// attach the .equals method to Array's prototype to call it on any array
function ArrayEquals (array1, array2) {
    // if the other array is a falsy value, return
    if (!array1 || !array2)
        return false;

    // compare lengths - can save a lot of time
    if (array1.length != array2.length)
        return false;

    for (let i = 0, l = array1.length; i < l; i++) {
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
}