export class CategoryGraph {
    constructor(){
        // default initializations of the parameters (can be changed to modify the graph)
        this.height = 530;
        this.width = "100%";          // width will be computer after
        this.node_diameter = [2, 25]; // min and max diameter of the nodes
        this.duration = 350
        this.degrees = 2*Math.PI;
    }

    drawGraph(divId, file){
        // Load the data, draw the table and start the graph
        d3.json(file, (error, data) => {
            if (error) throw error;

            // let this.pubs = {"names": [""], "children": convert_map(data), 'count': 1, 'isleaf': false};
            this.pubs = data; // store the data in a parameter

            this.i = 0
            this.roots = []

            let max_count = this.pubs["count"];
            this.diameterScale = d3.scaleLinear()
                .domain([0, Math.sqrt(max_count)])
                .range([this.node_diameter[0], this.node_diameter[1]]);

            // select the div
            let div = d3.select("#"+divId);
            // clear the div content
            div.selectAll("*").remove();

            // append a table to show all the visited categories and the the graph at the
            // same time
            // <table class="categories_table"> <!--categories_table_search-page-->
            //      <tr>
            //          <th>List view</th>
            //          <th>Tree view</th>
            //      </tr>
            //      <tr>
            //          <td id="category_view">
            //          </td>
            //          <td style="width: 700px;">
            //              <svg id="categories_graph" width="500px">
            //                  <defs>
            //                        <pattern id="image" x="0%" y="0%" height="100%" width="100%"
            //                        viewBox="0 0 512 512">
            //                            <image x="0%" y="0%" width="512" height="512"  xlink:href="img/back.png"></image>
            //                        </pattern>
            //                  </defs>
            //              </svg>
            //          </td>
            //      </tr>
            //  </table>
            let table = div.append("table")
                .attr("class", "categories_table")
                .attr("width", "100%")
                .attr("height", "100%")
            let row1 = table.append("tr")
            row1.append("th").html("List view")
            row1.append("th").html("Tree view")
            let row2 = table.append("tr")
            this.list_view = row2.append("td") // here we show the lis of visited categories
            let svg = row2.append("td").append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
            svg.append("defs").append("pattern")
                .attr("id", "back_image")
                .attr("x", "0%").attr("y", "0%").attr("height", "100%").attr("width", "100%").attr("viewBox", "0 0 512 512")
                .append("image").attr("x", "0%").attr("y", "0%").attr("height", "512").attr("width", "512").attr("href", "img/back.png")

            // update the width with the computed one
            let rect = svg.node().getBoundingClientRect()
            this.width = rect.width
            this.height = rect.height

            this.graph_view = svg.append("g")
                .attr("transform", () => "translate(" + this.width / 2 + "," + (this.height / 2) + ")")

            this.treemap = d3.tree()
                .size([this.degrees, this.width])
                .separation((a, b) => (a.parent == b.parent ? 1 : 10) / a.depth);

            //create the tooltip that will be show on mouse over the nodes
            this.tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            let curr_root =  d3.hierarchy(this.pubs, (d) => d.children);
            this.roots.push(curr_root);
            curr_root.x0 = this.height / 2;
            curr_root.y0 = 0;

            curr_root.children.forEach(collapse); // start with all children collapsed
            this.update(curr_root); // update the graph
            this.appendToList(curr_root); // update the list
        });
    }

    update(source) {
        let that = this
        let curr_root = this.roots[this.roots.length - 1];

        // Assign the x and y position to the nodes
        let root = this.treemap(curr_root);

        // Compute the new tree layout.
        let nodes = root.descendants(),
            links = root.links()

        // Normalize for fixed-depth.
        nodes.forEach((d) => d.y = d == curr_root ? 0 : 100);

        // ****************** Nodes section ***************************
        // Update the nodes...
        let node = this.graph_view.selectAll('g.node')
            .data(nodes, (d) => d.id || (d.id = ++this.i));
        let nodeEnter = node.enter().append('g')
            .attr('cursor', 'pointer')
            .attr('class', 'node')
            .attr("transform", (d) => "translate(" + radialPoint(source.x0, source.y0, this.degrees) + ")")
            .on('click', (d) => this.click(d))
            // show the tooltip
            .on("mouseover", (d) => {
                this.tooltip
                    .transition()
                    .duration(200)
                    .style("opacity", .9);
                this.tooltip
                    .html(
                        "<span><b>Number of products: </b>" + d.data.count.toLocaleString() + "</span>")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", (d) => {
                this.tooltip
                    .transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // Add Circle for the nodes
        nodeEnter.append("circle")
            .attr('r', 1e-6)
            .style("stroke", (d) => this.stroke(d))
            .style("fill", (d) => this.fill_category(d));

        let degrees_half = this.degrees /2
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
            .duration(this.duration)
            .attr("transform", (d) => "translate(" + radialPoint(d.x, d.y, this.degrees) + ")");

        // Update the node attributes and style
        nodeUpdate.select("circle")
            .attr("r", (d) => this.diameterScale(Math.sqrt(d.data.count)))
            .style("fill", (d) => that.fill_category(d))
            // for the node in the middle show a "back" image
            .filter((d) =>
                ArrayEquals(d.data.names, curr_root.data.names) && !ArrayEquals(d.data.names, ["Amazon"]))
            .style("fill", "")
            .attr("fill", "url(#back_image)");

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
            .attr("transform", (d) => "rotate(0)translate(0," + (this.diameterScale(Math.sqrt(d.data.count)) + 10 * d.data.names.length) + ")") //todo?
            .attr("text-anchor", "middle")
            .attr("class", "root_node")
        // .attr('cursor', 'pointer'); todo ?

        // Remove any exiting nodes
        let nodeExit = node.exit().transition()
            .duration(this.duration)
            .attr("transform", (d) => "translate(" + radialPoint(source.x, source.y, this.degrees) + ")")
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // ****************** links section ***************************

        // Update the links…
        let link = this.graph_view.selectAll("path.link")
            .data(links, (d) =>  d.id);

        // Enter any new links at the parent's previous position.
        let linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))

        // UPDATE
        let linkUpdate = linkEnter.merge(link)

        // Transition back to the parent element position
        linkUpdate.transition()
            .duration(this.duration)
            .attr("d", d3.linkRadial().angle((d) => d.x).radius((d) => d.y))

        // Remove any exiting links
        let linkExit = link.exit().transition()
            .duration(this.duration)
            .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function radialPoint(x, y, degrees) {
            let degrees_half = degrees/2;
            return [(y = +y) * Math.cos(x -= degrees_half / 2), y * Math.sin(x)];
        }
    }

    appendToList(d) {
        let that = this
        let category_name = d.data.names.join(" & ")

        this.list_view.append("p")
            .style("cursor", "pointer")
            .text(category_name)
            .on("click", () => {
                // delete all the roots up to this one
                that.roots = that.roots.slice(0, that.roots.indexOf(d))
                collapse(d);

                while (that.list_view.select("p:last-child").text() != category_name) {
                    that.list_view.select("p:last-child").remove()
                }
                that.list_view.select("p:last-child").remove()

                that.click(d)
            });
    }

    // Toggle children on click.
    click(d) {
        if (d.data.isleaf) {
            return
        }

        if (d.children) {
            if (this.roots.length == 1) {
                // don't collapse the root "amazon"
                return
            }

            // collapse tree
            d._children = d.children;
            d.children = null;

            // restore the "parent" root
            this.roots.pop();

            // remove the last element from the list
            this.list_view.select("p:last-child").remove()
        } else {
            // expand tree
            d.children = d._children;
            d._children = null;

            // this node must be the root now
            // let curr_root = roots[roots.length-1];
            // let new_root = curr_root.children.find(node => ArrayEquals(node.names, d.names))
            this.roots.push(d)

            // show in the list the parent category
            this.appendToList.call(this, d)
        }

        this.update(d);
    }

    fill_category(node) {
        if (node.data.isleaf || (!node._children && !node.children)) {
            return "LightGreen";
        }

        if (node._children) { // collapsed
            return "lightsteelblue";
        }

        return "#fff" // expanded
    }

    stroke(node) {
        if (node.isleaf || (!node._children && !node.children)) {
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

// Collapse nodes
function collapse(d) {
    if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
    }
}

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