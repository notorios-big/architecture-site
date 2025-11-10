// src/views/FlowView.jsx
const { useState, useEffect, useMemo, useCallback } = React;
const { nodeVolume } = window;
const {
  IFolderOpen, ITrash, IEdit, ICheck, IChevronR, IChevronD, IEye
} = window;

// Verificar que ReactFlow esté disponible
const ReactFlowLib = window.ReactFlow || {};

console.log('ReactFlow library loaded:', !!ReactFlowLib);
console.log('Available exports:', Object.keys(ReactFlowLib));

// Extraer componentes de ReactFlow
const ReactFlowComponent = ReactFlowLib.default || ReactFlowLib.ReactFlow;
const {
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges
} = ReactFlowLib;

const FlowView = ({
  tree,
  expandedNodes,
  toggleFlowNode,
  renameNode,
  deleteNode,
  setKeywordModal
}) => {
  // Componente de nodo custom
  const CustomNode = ({ data }) => {
    const { node, volume, isExpanded, onToggle, onShowKeywords, onRename, onDelete } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(node.name || '');

    useEffect(() => {
      setEditText(node.name || '');
    }, [node.name]);

    const childGroups = node.isGroup && node.children
      ? node.children.filter(c => c.isGroup)
      : [];
    const hasChildGroups = childGroups.length > 0;

    const keywordCount = node.isGroup && node.children
      ? node.children.filter(c => !c.isGroup).length
      : 0;

    return (
      <div className="custom-node">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <IFolderOpen size={18} className="text-white flex-shrink-0"/>
            {isEditing ? (
              <input
                className="flex-1 px-2 py-1 text-sm border border-white rounded bg-white/20 text-white placeholder-white/70"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRename(node.id, editText);
                    setIsEditing(false);
                  }
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-white font-semibold text-sm truncate">
                {node.name || node.keyword}
              </span>
            )}
            <button
              onClick={() => onDelete(node.id)}
              className="p-1 hover:bg-white/20 rounded transition-all"
            >
              <ITrash size={14} className="text-white"/>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 text-white text-xs">
            <div className="bg-white/20 px-2 py-1 rounded-full font-bold">
              {volume.toLocaleString('es-CL')} vol.
            </div>
            {node.isGroup && keywordCount > 0 && (
              <div className="bg-white/20 px-2 py-1 rounded-full">
                {keywordCount} KWs
              </div>
            )}
          </div>

          <div className="flex gap-1">
            {hasChildGroups && (
              <button
                onClick={onToggle}
                className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
              >
                {isExpanded ? <IChevronD size={12}/> : <IChevronR size={12}/>}
                {isExpanded ? 'Contraer' : 'Expandir'}
              </button>
            )}

            {node.isGroup && keywordCount > 0 && (
              <button
                onClick={onShowKeywords}
                className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
              >
                <IEye size={12}/>
                Ver KWs
              </button>
            )}

            {node.isGroup && !isEditing && (
              <button
                onClick={() => {
                  setEditText(node.name || '');
                  setIsEditing(true);
                }}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white transition-all"
              >
                <IEdit size={12}/>
              </button>
            )}
            {isEditing && (
              <button
                onClick={() => {
                  onRename(node.id, editText);
                  setIsEditing(false);
                }}
                className="px-2 py-1 bg-green-500 hover:bg-green-600 rounded text-white transition-all"
              >
                <ICheck size={12}/>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Generar nodos y edges del árbol
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    const HORIZONTAL_SPACING = 400;
    const VERTICAL_SPACING = 150;
    const levelPositions = new Map();

    const traverse = (node, level = 0, parentId = null) => {
      if (!node) return;

      const nodeId = node.id;
      const isExpanded = expandedNodes.has(nodeId);

      if (!levelPositions.has(level)) {
        levelPositions.set(level, []);
      }

      const usedPositions = levelPositions.get(level);
      const yPosition = usedPositions.length * VERTICAL_SPACING;
      usedPositions.push(yPosition);

      nodes.push({
        id: nodeId,
        type: 'custom',
        position: {
          x: level * HORIZONTAL_SPACING,
          y: yPosition
        },
        data: {
          node,
          volume: nodeVolume(node),
          isExpanded,
          onToggle: () => toggleFlowNode(nodeId),
          onShowKeywords: () => setKeywordModal(node),
          onRename: renameNode,
          onDelete: deleteNode
        }
      });

      if (parentId) {
        edges.push({
          id: `e${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#8b5cf6',
          }
        });
      }

      if (isExpanded && node.isGroup && node.children) {
        const childGroups = node.children.filter(c => c.isGroup);
        childGroups.forEach(child => {
          traverse(child, level + 1, nodeId);
        });
      }
    };

    tree.forEach(node => traverse(node));

    return { nodes, edges };
  }, [tree, expandedNodes, toggleFlowNode, renameNode, deleteNode, setKeywordModal]);

  // Estado local para nodos y edges
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // Actualizar cuando cambia el árbol
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  // Handlers
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges ? applyNodeChanges(changes, nds) : nds);
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges ? applyEdgeChanges(changes, eds) : eds);
  }, []);

  const onConnect = useCallback((params) => {
    console.log('Nueva conexión:', params);
    setEdges((eds) => {
      if (!addEdge) return eds;
      return addEdge({
        ...params,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 3 },
        markerEnd: {
          type: 'arrowclosed',
          color: '#10b981',
        }
      }, eds);
    });
  }, []);

  if (!ReactFlowComponent) {
    return (
      <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="flex items-center justify-center h-full text-gray-600">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">ReactFlow no está disponible</p>
            <p className="text-sm">Por favor, recarga la página</p>
            <p className="text-xs mt-4 text-gray-500 max-w-md">
              Asegúrate de que el CDN de ReactFlow esté cargando correctamente.
              Verifica la consola para más detalles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const FlowWrapper = ReactFlowProvider || (({ children }) => children);

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
      <FlowWrapper>
        <ReactFlowComponent
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
          }}
        >
          {Background && <Background color="#e5e7eb" gap={16} />}
          {Controls && <Controls />}
          {MiniMap && (
            <MiniMap
              nodeColor={() => '#8b5cf6'}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          )}
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '10px',
            background: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: '12px',
            zIndex: 5
          }}>
            <strong>💡 Controles:</strong><br/>
            • Arrastra nodos para moverlos<br/>
            • Arrastra desde el borde para conectar<br/>
            • Selecciona y presiona Delete para eliminar<br/>
            • Usa la rueda del mouse para zoom
          </div>
        </ReactFlowComponent>
      </FlowWrapper>
    </div>
  );
};

window.FlowView = FlowView;
