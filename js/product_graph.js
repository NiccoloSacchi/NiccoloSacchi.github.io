let width = document.getElementsByTagName("article")[0].clientWidth,     // svg width
    height = 600,     // svg height
    dr = 4,      // default point radius
    off = 15,    // cluster hull offset
    expand = {}, // expanded clusters
    data, net, force, hullg, hull, linkg, link, nodeg, node;

let curve = d3.svg.line()
    .interpolate("cardinal-closed")
    .tension(.85);

function isGroup(d){
    return d.size && d.size>1
}

function belongToGroup(d) {
    return isGroup(d) || d.group_data.size>1
}

// let fill_ = d3.scale.category20();
function fill_cluster(d){
    if (!isGroup(d)) {
        return "red"
    }
    else{
        return "blue"
    }
}

function createTooltip(d) {
    if (d.size) {
        if (d.size == 1) {
            return d.nodes[0].name
        }
        else{
            return "<b>Number of elements:</b> " + d.size
        }
    }
    return d.name
}

function noop() { return false; }

function nodeid(n) {
  return n.size ? "_g_"+n.group : n.name;
}

function linkid(l) {
    let u = nodeid(l.source),
      v = nodeid(l.target);
    return u<v ? u+"|"+v : v+"|"+u;
}

function getGroup(n) { return n.group; }

// constructs the network to visualize
function network(data, prev, index, expand) {
    expand = expand || {};
    let gm = {},    // group map
      nm = {},    // node map
      lm = {},    // link map
      gn = {},    // previous group nodes
      gc = {},    // previous group centroids
      nodes = [], // output nodes
      links = []; // output links

    // process previous nodes for reuse or centroid calculation
    if (prev) {
        prev.nodes.forEach((n) => {
        let i = index(n), o;
            if (n.size > 0) {
                gn[i] = n;
                n.size = 0;
            } else {
                o = gc[i] || (gc[i] = {x:0,y:0,count:0});
                o.x += n.x;
                o.y += n.y;
                o.count += 1;
            }
        });
    }

    // determine nodes
    for (let k=0; k<data.nodes.length; ++k) {
        let n = data.nodes[k],
            i = index(n), // get group
            l = gm[i] || (gm[i]=gn[i]) || (gm[i]={group:i, size:0, nodes:[]});

        if (expand[i]) {
            // the node should be directly visible
            nm[n.name] = nodes.length;
            nodes.push(n);
            if (gn[i]) {
                // place new nodes at cluster location (plus jitter)
                n.x = gn[i].x + Math.random();
                n.y = gn[i].y + Math.random();
            }
        } else {
        // the node is part of a collapsed cluster
        if (l.size == 0) {
            // if new cluster, add to set and position at centroid of leaf nodes
            nm[i] = nodes.length;
            nodes.push(l);
            if (gc[i]) {
                l.x = gc[i].x / gc[i].count;
                l.y = gc[i].y / gc[i].count;
            }
        }
            l.nodes.push(n);
        }
        // always count group size as we also use it to tweak the force graph strengths/distances
        l.size += 1;
        n.group_data = l;
    }

    // initialize all link count to 0 (for each node)
    for (let i in gm) { gm[i].link_count = 0; }

    // determine links
    for (let k=0; k<data.links.length; ++k) {
        let e = data.links[k],
            u = index(e.source),
            v = index(e.target);
        if (u != v) {
            gm[u].link_count++;
            gm[v].link_count++;
        }
        u = expand[u] ? nm[e.source.name] : nm[u];
        v = expand[v] ? nm[e.target.name] : nm[v];
        let i = (u<v ? u+"|"+v : v+"|"+u),
            l = lm[i] || (lm[i] = {source:u, target:v, size:0, left:e.left, right:e.right});
            l.size += 1;
    }
    for (let i in lm) { links.push(lm[i]); }

    // nodes is a list of {group: x, size: n, nodes: Array(n), link_count: 1} in which nodes
    // are like {name: "Myriel", group: x, group_data: {…}}, group_data links again to {group: x, size: n, nodes: Array(n), link_count: 1}

    // links is a list of {source: 0, target: 102, size: 1, left: false, right: true}
    // source and target are the ids of the nodes in the list
    return {nodes: nodes, links: links};
}

function convexHulls(nodes, index, offset) {
    let hulls = {};

    // create point sets
    for (let k=0; k<nodes.length; ++k) {
        let n = nodes[k];
        if (n.size) continue;
        let i = index(n),
            l = hulls[i] || (hulls[i] = []);
        l.push([n.x-offset, n.y-offset]);
        l.push([n.x-offset, n.y+offset]);
        l.push([n.x+offset, n.y-offset]);
        l.push([n.x+offset, n.y+offset]);
    }

    // create convex hulls
    let hullset = [];
    for (let i in hulls) {
        hullset.push({group: i, path: d3.geom.hull(hulls[i])});
    }

    return hullset;
}

function drawCluster(d) {
    return curve(d.path); // 0.8
}

// --------------------------------------------------------

let body = d3.select("body");

let tooltip = body.append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

let vis = body.select("#product_graph")
   .attr("width", width)
   .attr("height", height);

// define arrow markers for graph links
let defs = vis.append('defs');
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

vis.attr("opacity", 1e-6)
    .transition()
    .duration(1000)
    .attr("opacity", 1);

d3.json("data/graph.json", (json) => {
    data = json;
    for (let i=0; i<data.links.length; ++i) {
        // source and target of the link are now pointers to the structure
        // of a node instead of just number
        let o = data.links[i];
        o.source = data.nodes[o.source];
        o.target = data.nodes[o.target];
    }

    hullg = vis.append("g");
    linkg = vis.append("g");
    nodeg = vis.append("g");

    // // keep the groups with a single nodes expanded
    // let groups = data.nodes.map((e) => e.group);
    // let size = {};
    // for (let i=0; i<groups.length; i++){
    //     size[groups[i]] = (size[groups[i]]+1) || 1;
    // }
    // for (let i=0; i<groups.length; i++){
    //     if (size[groups[i]] == 1) {
    //         expand[groups[i]] = true;
    //     }
    // }

    init();
});

function init() {
    if (force) force.stop();

    net = network(data, net, getGroup, expand);

    force = d3.layout.force()
        .nodes(net.nodes)
        .links(net.links)
        .size([width, height])
        .linkDistance((l, i) => {
            let n1 = l.source, n2 = l.target;
            // larger distance for bigger groups:
            // both between single nodes and _other_ groups (where size of own node group still counts),
            // and between two group nodes.
            //
            // reduce distance for groups with very few outer links,
            // again both in expanded and grouped form, i.e. between individual nodes of a group and
            // nodes of another group or other group node or between two group nodes.
            //
            // The latter was done to keep the single-link groups ('blue', rose, ...) close.
            return 30 +
              Math.min(20 * Math.min((n1.size || (n1.group != n2.group ? n1.group_data.size : 0)),
                                     (n2.size || (n1.group != n2.group ? n2.group_data.size : 0))),
                   -30 +
                   30 * Math.min((n1.link_count || (n1.group != n2.group ? n1.group_data.link_count : 0)),
                                 (n2.link_count || (n1.group != n2.group ? n2.group_data.link_count : 0))),
                   100);
              //return 150;
        })
        .linkStrength(() => 1)
        .gravity(0.3)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
        .charge(-600)    // ... charge is important to turn single-linked groups to the outside
        .friction(0.5)   // friction adjusted to get dampened display: less bouncy bouncy ball [Swedish Chef, anyone?]
        .start();

    hullg.selectAll("path.hull").remove();
    hull = hullg.selectAll("path.hull")
        .data(convexHulls(net.nodes, getGroup, off))
        .enter().append("path")
        .attr("class", "hull")
        .attr("d", drawCluster)
        .style("fill", (d) => "blue")//.group))
        .on("click", (d) => {
            // console.log("hull click", d, arguments, this, expand[d.group]);
            expand[d.group] = false;
            init();
        });

    link = linkg.selectAll("line.link").data(net.links, linkid);
    link.exit().remove();
    link.enter().append("line")
        .filter((d) => !(d.source.group==d.target.group && !expand[d.target.group]))
        .attr("class", "link")
        .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
        .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)
        .style("stroke-width", (d) => 1 || d.size || 1);

    node = nodeg.selectAll("circle.node").data(net.nodes, nodeid);
    node.exit().remove();
    node.enter().append("circle")
        // if (d.size) -- d.size > 0 when d is a group node.
        .attr("class", (d) =>  "node" + (d.size?"":" leaf"))
        .attr("r", (d) => d.size ? d.size + dr : dr+1)
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .style("fill", (d) => fill_cluster(d))//.group))
        .on("click", (d) => {
            if (!belongToGroup(d)){return}
            // console.log("node click", d, arguments, this, expand[d.group]);
            expand[d.group] = !expand[d.group];
            init();
        })
        .on("mouseover", (d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(createTooltip(d))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", (d) => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    //nodeg.selectAll("circle.node").append("text")
    // .text("asd")
    // .attr("text-anchor", (d) => d.x < 180? "start" : "end")
    // .attr("transform", (d) => { d.x < 180 ? "translate(0)" : "rotate(180)translate(-" + (d.name.length * 8.5)  + ")"})
    // .style("fill-opacity", 1e-6)

    // node.call(force.drag);

    force.on("tick", () => {
        if (!hull.empty()) {
            hull.data(convexHulls(net.nodes, getGroup, off))
                .attr("d", drawCluster);
    }

    link.attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) =>d.target.y)

    node.attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y);
    });
}
