// src/views/FlowView.jsx
const { useState, useEffect, useMemo, useCallback } = React;
const { nodeVolume } = window;
const {
  IFolderOpen, ITrash, IEdit, ICheck, IChevronR, IChevronD, IEye
} = window;

const waitForReactFlow = (() => {
  let warned = false;

  return () => {
    if (window.ReactFlow) {
      return window.ReactFlow;
    }

    if (!warned) {
      console.warn('ReactFlow todavía no está disponible, reintentando...');
      warned = true;
    }

    return null;
  };
})();

const FlowCanvas = ({
  tree,
  expandedNodes,
  toggleFlowNode,
  renameNode,
  deleteNode,
  setKeywordModal,
  onMoveNode,
  reactFlowLib
}) => {
  const {
    ReactFlow: ReactFlowFromLib,
    default: DefaultReactFlow,
    ReactFlowProvider,
    Controls,
    MiniMap,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    MarkerType,
    Handle,
    Position
  } = reactFlowLib;

  const ReactFlowComponent = ReactFlowFromLib || DefaultReactFlow;
  const FlowProvider = ReactFlowProvider || (({ children }) => children);
  const ControlsComponent = Controls || (() => null);
  const MiniMapComponent = MiniMap || (() => null);
  const BackgroundComponent = Background || (() => null);

  if (!ReactFlowComponent) {
    console.error('ReactFlow no está disponible en la librería cargada', reactFlowLib);
    return (
      <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex items-center justify-center" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="text-center text-gray-600 p-10">
          <p className="text-lg font-semibold mb-2">Error al inicializar React Flow</p>
          <p className="text-sm">No pudimos encontrar el componente ReactFlow en la librería cargada desde la CDN.</p>
          <p className="text-xs mt-3">Revisa que la versión de React Flow sea compatible o intenta recargar la página.</p>
        </div>
      </div>
    );
  }

  const CustomNode = useCallback(({ data, selected }) => {
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
      <div className={`custom-node ${selected ? 'custom-node-selected' : ''}`}>
        {Handle && Position && (
          <>
            <Handle
              type="target"
              position={Position.Left}
              className="custom-handle target"
            />
            <Handle
              type="source"
              position={Position.Right}
              className="custom-handle source"
            />
          </>
        )}

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
  }, [Handle, Position]);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), [CustomNode]);

  const treeToFlow = useMemo(() => {
    const nodes = [];
    const edges = [];

    const HORIZONTAL_SPACING = 380;
    const VERTICAL_SPACING = 160;

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
        draggable: true,
        selectable: true,
        connectable: true,
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
          id: `${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
          markerEnd: MarkerType ? {
            type: MarkerType.ArrowClosed,
            color: '#8b5cf6'
          } : undefined
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
  }, [tree, expandedNodes, toggleFlowNode, renameNode, deleteNode, setKeywordModal, MarkerType]);

  const [nodes, setNodes] = useState(treeToFlow.nodes);
  const [edges, setEdges] = useState(treeToFlow.edges);

  const applyNodeChangesFallback = useCallback((changes, currentNodes) => {
    return changes.reduce((acc, change) => {
      if (change.type === 'remove') {
        return acc.filter(node => node.id !== change.id);
      }

      if (change.type === 'add' && change.item) {
        return [...acc, change.item];
      }

      if (change.type === 'reset') {
        return acc.map(node => ({ ...node, selected: false }));
      }

      return acc.map(node => {
        if (node.id !== change.id) return node;

        switch (change.type) {
          case 'position':
            return { ...node, position: change.position, dragging: change.dragging };
          case 'select':
            return { ...node, selected: change.selected };
          case 'dimensions':
            return { ...node, width: change.dimensions?.width, height: change.dimensions?.height };
          default:
            return node;
        }
      });
    }, currentNodes);
  }, []);

  const applyEdgeChangesFallback = useCallback((changes, currentEdges) => {
    return changes.reduce((acc, change) => {
      if (change.type === 'remove') {
        return acc.filter(edge => edge.id !== change.id);
      }

      if (change.type === 'add' && change.item) {
        return [...acc, change.item];
      }

      if (change.type === 'select') {
        return acc.map(edge => edge.id === change.id ? { ...edge, selected: change.selected } : edge);
      }

      if (change.type === 'reset') {
        return acc.map(edge => ({ ...edge, selected: false }));
      }

      return acc;
    }, currentEdges);
  }, []);

  const onNodesChange = useCallback((changes) => {
    setNodes((prev) => {
      if (typeof applyNodeChanges === 'function') {
        return applyNodeChanges(changes, prev);
      }

      return applyNodeChangesFallback(changes, prev);
    });
  }, [applyNodeChanges, applyNodeChangesFallback]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => {
      if (typeof applyEdgeChanges === 'function') {
        return applyEdgeChanges(changes, prev);
      }

      return applyEdgeChangesFallback(changes, prev);
    });
  }, [applyEdgeChanges, applyEdgeChangesFallback]);

  useEffect(() => {
    setNodes((prevNodes) => {
      const positionMap = new Map(prevNodes.map(n => [n.id, n.position]));

      return treeToFlow.nodes.map(node => {
        const previousPosition = positionMap.get(node.id);
        if (previousPosition) {
          return {
            ...node,
            position: previousPosition
          };
        }
        return node;
      });
    });
  }, [treeToFlow.nodes, setNodes]);

  useEffect(() => {
    setEdges(treeToFlow.edges);
  }, [treeToFlow.edges, setEdges]);

  const handleConnect = useCallback((params) => {
    const markerEnd = MarkerType ? {
      type: MarkerType.ArrowClosed,
      color: '#8b5cf6'
    } : undefined;

    const newEdge = {
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#8b5cf6', strokeWidth: 2 },
      markerEnd
    };

    const ensureId = (edge) => ({
      id: edge.id || `${edge.source}-${edge.target}-${Date.now()}`,
      ...edge
    });

    setEdges((eds) => {
      const nextEdge = ensureId(newEdge);
      if (typeof addEdge === 'function') {
        const result = addEdge(nextEdge, eds);
        return Array.isArray(result) ? result : [...eds, nextEdge];
      }

      return [...eds, nextEdge];
    });

    if (onMoveNode) {
      onMoveNode(params.source, params.target);
    }
  }, [addEdge, setEdges, MarkerType, onMoveNode]);

  const handleEdgeDoubleClick = useCallback((_, edge) => {
    setEdges((eds) => eds.filter(e => e.id !== edge.id));
  }, [setEdges]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setEdges((eds) => eds.filter(edge => !edge.selected));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEdges]);

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
      <FlowProvider>
        <ReactFlowComponent
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid
          fitView
          fitViewOptions={{ padding: 0.2 }}
          connectionMode="loose"
          panOnScroll
          elementsSelectable
          selectionOnDrag
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            markerEnd: MarkerType ? {
              type: MarkerType.ArrowClosed,
              color: '#8b5cf6'
            } : undefined
          }}
        >
          <BackgroundComponent color="#e5e7eb" gap={16} variant="dots"/>
          <ControlsComponent position="top-right"/>
          <MiniMapComponent
            nodeColor={() => '#8b5cf6'}
            nodeStrokeWidth={2}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlowComponent>
      </FlowProvider>
    </div>
  );
};

const FlowView = (props) => {
  const [reactFlowLib, setReactFlowLib] = useState(() => waitForReactFlow());
  const [triedLoading, setTriedLoading] = useState(!!reactFlowLib);

  useEffect(() => {
    if (reactFlowLib) {
      return;
    }

    let mounted = true;
    let attempts = 0;

    const checkLibrary = () => {
      if (!mounted) return;
      const lib = waitForReactFlow();
      attempts += 1;

      if (lib) {
        setReactFlowLib(lib);
      } else if (attempts < 50) {
        requestAnimationFrame(checkLibrary);
      } else {
        setTriedLoading(true);
      }
    };

    checkLibrary();

    return () => {
      mounted = false;
    };
  }, [reactFlowLib]);

  if (!reactFlowLib) {
    return (
      <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex items-center justify-center" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="text-center text-gray-600 p-10">
          <p className="text-lg font-semibold mb-2">Cargando motor de flujo…</p>
          <p className="text-sm">Estamos preparando las herramientas de Drawflow.</p>
          {triedLoading && (
            <p className="text-xs mt-3">Si el mensaje persiste, revisa tu conexión a la CDN de ReactFlow.</p>
          )}
        </div>
      </div>
    );
  }

  return <FlowCanvas {...props} reactFlowLib={reactFlowLib}/>;
};

window.FlowView = FlowView;
