import { LitElement, html, css } from 'lit';

export class OverworldMap extends LitElement {
  static properties = {
    nodes: { type: Array },
    lines: { type: Array },
    activeNode: { type: Object, reflect: true }
  };

  constructor() {
    super();
    this.nodes = [];
    this.lines = [];
    this.activeNode = null;
  }

  firstUpdated() {
    const canvas = this.shadowRoot.getElementById('mapCanvas');
    this.ctx = canvas.getContext('2d');
    this.loadData();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  async loadData() {
    const response = await fetch('../lib/data.json');
    const jsonData = await response.json();
    this.processData(jsonData);
    this.draw();
  }

  processData(data) {
    const positions = {};
    let topicIndex = 0;
    const topicSpacing = this.offsetWidth / (data.filter(item => item.type === 'topic').length + 1);
    const sectionSpacing = 150; // Increased space between subsections

    // Calculate positions for topics and subsections
    data.forEach(item => {
      if (item.type === 'topic') {
        positions[item.id] = {
          x: topicSpacing * (topicIndex + 1),
          y: 100
        };
        topicIndex++;
      } else if (item.type === 'subsection') {
        const parent = data.find(topic => topic.sections && topic.sections.includes(item.id));
        if (parent && positions[parent.id]) {
          let index = parent.sections.indexOf(item.id);
          positions[item.id] = {
            x: positions[parent.id].x,
            y: positions[parent.id].y + (index + 1) * sectionSpacing
          };
        }
      }
    });

    // Create nodes
    data.forEach(item => {
      const node = new MapNode(
        item.id,
        positions[item.id].x,
        positions[item.id].y,
        55,
        item.name,
        item.isActive || false,
        false,
        Array.isArray(item.relatedTo) ? item.relatedTo : [],  // Ensure relations is always an array
        item.sections || [],  // Ensure sections is always an array
        item.type
      );
    
      if (item.type === 'subsection') {
        const parent = data.find(topic => topic.sections && topic.sections.includes(item.id));
        if (parent) {
          const siblingSections = parent.sections.filter(sectionId => sectionId !== item.id);
          node.relations = node.relations.concat(siblingSections);
        }
      }
    
      this.nodes.push(node);
      if (item.isActive) this.activeNode = node;
    });
    
    // Create lines
    this.nodes.forEach(node => {
      const item = data.find(d => d.id === node.id);
      if (item.sections) {
        // Connect only to the first section
        const firstSectionId = item.sections[0];
        const firstSectionNode = this.nodes.find(n => n.id === firstSectionId);
        if (firstSectionNode) {
          const line = new MapLine(node, firstSectionNode, false);
          this.lines.push(line);
        }
  
        // Connect sections to their previous and next siblings
        item.sections.forEach((sectionId, index) => {
          const sectionNode = this.nodes.find(n => n.id === sectionId);
          if (sectionNode) {
            // Connect to previous sibling
            if (index > 0) {
              const prevSiblingId = item.sections[index - 1];
              const prevSiblingNode = this.nodes.find(n => n.id === prevSiblingId);
              if (prevSiblingNode) {
                const line = new MapLine(prevSiblingNode, sectionNode, false);
                this.lines.push(line);
              }
            }
  
            // Connect to next sibling
            if (index < item.sections.length - 1) {
              const nextSiblingId = item.sections[index + 1];
              const nextSiblingNode = this.nodes.find(n => n.id === nextSiblingId);
              if (nextSiblingNode) {
                const line = new MapLine(sectionNode, nextSiblingNode, false);
                this.lines.push(line);
              }
            }
          }
        });
      }
  
      if (item.relatedTo) {
        item.relatedTo.forEach(relatedId => {
          const endNode = this.nodes.find(n => n.id === relatedId);
          if (endNode) {
            const line = new MapLine(node, endNode, false);  // Pass false for isDashed
            this.lines.push(line);
          }
        });
      }
    });
    
    console.log(this.nodes);
    console.log(this.lines);
    
    this.updateAvailableNodes();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.offsetWidth, this.offsetHeight);

    // Draw solid lines for topic-section relationships and check dashed lines
    this.lines.forEach(line => {
      const isSectionRelation = (line.startNode.type === 'topic' && line.endNode.type === 'subsection');
      const isReverseRelated = line.endNode.relations.includes(line.startNode.id);
  
      ctx.beginPath();
      ctx.moveTo(line.startNode.x, line.startNode.y);
      ctx.lineTo(line.endNode.x, line.endNode.y);
      ctx.strokeStyle = 'black';
  
      // If it's a relation between a topic and a section, or a mutual relation, draw a solid line
      ctx.setLineDash(isReverseRelated ? [] : [5, 5]);
      if(!isReverseRelated){
        ctx.strokeStyle = 'red';
      }
      else{
        ctx.strokeStyle = 'black';
      }
      if(isSectionRelation){
        ctx.setLineDash([]);
        ctx.strokeStyle = 'black';
      }
  
      ctx.stroke();
  
      // Draw arrow for one-way dashed paths
      if (!isReverseRelated && !isSectionRelation) {
        console.log('drawing arrow')
        const endRadians = Math.atan2(line.endNode.y - line.startNode.y, line.endNode.x - line.startNode.x);
        const endX = line.endNode.x - ((15 + line.endNode.radius) * Math.cos(endRadians));
        const endY = line.endNode.y - ((15 + line.endNode.radius) * Math.sin(endRadians));
        const arrowRadians = Math.PI / 5;  // Increase the angle to make the arrow wider
        const arrowLength = 20;  // Increase the length to make the arrow longer
        
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLength * Math.cos(endRadians - arrowRadians), endY - arrowLength * Math.sin(endRadians - arrowRadians));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLength * Math.cos(endRadians + arrowRadians), endY - arrowLength * Math.sin(endRadians + arrowRadians));
        ctx.stroke();
      }
    });

    this.nodes.forEach(node => {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.isActive ? '#518ab2' : (node.isAvailable ? '#99bcd6' : '#D3D3D3');
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.stroke();
      ctx.font = "20px Arial";
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x, node.y);
    });
  }

  handleMouseMove(e) {
    const rect = this.shadowRoot.getElementById('mapCanvas').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hoveredNode = this.nodes.find(node => node.isPointInside(x, y));
  
    this.draw(); // Redraw to clear previous highlights
  
    if (hoveredNode) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(hoveredNode.x, hoveredNode.y, hoveredNode.radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFF00'; // Highlight color, here using yellow
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.stroke();
      ctx.font = "16px Arial";
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hoveredNode.name, hoveredNode.x, hoveredNode.y);
    }
  }
  
  handleClick(e) {
    const rect = this.shadowRoot.getElementById('mapCanvas').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedNode = this.nodes.find(node => node.isPointInside(x, y) && node.isAvailable);
  
    if (clickedNode) {
      if (this.activeNode) {
        this.activeNode.setActive(false);
      }
      this.activeNode = clickedNode;
      clickedNode.setActive(true);
      this.updateAvailableNodes();
      this.draw();
    }
  }

  updateAvailableNodes() {
    if (!this.activeNode) return;
  
    const activeRelatedIds = new Set(this.activeNode.relations);
    activeRelatedIds.add(this.activeNode.id); // Include the active node itself
  
    // If the active node is a topic, only add the first section to the available nodes
    if (this.activeNode.type === 'topic' && this.activeNode.sections.length > 0) {
      activeRelatedIds.add(this.activeNode.sections[0]);
    }
  
    // If the active node is a subsection, add its parent topic, and next sibling to the available nodes
    if (this.activeNode.type === 'subsection') {
      const parent = this.nodes.find(node => node.sections && node.sections.includes(this.activeNode.id));
      if (parent) {
        activeRelatedIds.add(parent.id);
        const activeNodeIndex = parent.sections.indexOf(this.activeNode.id);
        if (activeNodeIndex < parent.sections.length - 1) { // If there is a next sibling
          activeRelatedIds.add(parent.sections[activeNodeIndex + 1]);
        }
      }
    }
  
    this.nodes.forEach(node => {
      node.isAvailable = activeRelatedIds.has(node.id);
      node.isActive = node === this.activeNode;
    });
  }

  render() {
    return html`
      <canvas id="mapCanvas" @mousemove="${this.handleMouseMove}" @click="${this.handleClick}"></canvas>
    `;
  }
}

window.customElements.define('overworld-map', OverworldMap);

// MapNode.js
class MapNode {
  constructor(id, x, y, radius, name, isActive, isAvailable, relations, sections, type) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = 55;
    this.name = name;
    this.isActive = isActive;
    this.isAvailable = isAvailable;
    this.relations = relations;
    this.sections = sections;
    this.type = type;
  }

  setActive(isActive) {
    this.isActive = isActive;
    this.isAvailable = !isActive;
  }

  isPointInside(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }
}

// MapLine.js
class MapLine {
  constructor(startNode, endNode, isDashed) {
    this.startNode = startNode;
    this.endNode = endNode;
    this.isDashed = isDashed;
  }
}
