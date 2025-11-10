// src/views/FlowView.jsx
const { useState, useEffect, useMemo, useCallback } = React;
const { nodeVolume } = window;
const {
  IFolderOpen, ITrash, IEdit, ICheck, IChevronR, IChevronD, IEye
} = window;

// Verificar que ReactFlow esté disponible y obtener todas las dependencias
const ReactFlowLib = window.ReactFlow || window.ReactFlowRenderer || {};

console.log('ReactFlow disponible:', !!ReactFlowLib);
console.log('Exports de ReactFlow:', Object.keys(ReactFlowLib));

// Obtener componentes y funciones de ReactFlow
const ReactFlowComponent = ReactFlowLib.default || ReactFlowLib.ReactFlow;
const ReactFlowProvider = ReactFlowLib.ReactFlowProvider;
const Controls = ReactFlowLib.Controls;
const MiniMap = ReactFlowLib.MiniMap;
const Background = ReactFlowLib.Background;
const useNodesState = ReactFlowLib.useNodesState;
const useEdgesState = ReactFlowLib.useEdgesState;
const addEdge = ReactFlowLib.addEdge;
const MarkerType = ReactFlowLib.MarkerType || {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed'
};

// Si ReactFlowProvider no está disponible, usar un wrapper simple
const FlowProvider = ReactFlowProvider || (({ children }) => children);

const FlowView = ({
  tree,
  expandedNodes,
  toggleFlowNode,
  renameNode,
  deleteNode,
  setKeywordModal,
  onMoveNode // Nueva prop para mover nodos entre grupos
}) => {
  const CustomNode = ({ data }) => {
    const { node, volume, isExpanded, onToggle, onShowKeywords, onRename, onDelete } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(node.name || '');

    // Sincronizar editText cuando el nodo cambia
    useEffect(() => {
      setEditText(node.name || '');
    }, [node.name]);

    // Solo contar grupos hijos, no keywords
    const childGroups = node.isGroup && node.children 
      ? node.children.filter(c => c.isGroup) 
      : [];
    const hasChildGroups = childGroups.length > 0;
    
    // Contar todas las keywords (directas + en subgrupos)
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
            {/* Botón Contraer/Expandir - solo si tiene grupos hijos */}
            {hasChildGroups && (
              <button
                onClick={onToggle}
                className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
              >
                {isExpanded ? <IChevronD size={12}/> : <IChevronR size={12}/>}
                {isExpanded ? 'Contraer' : 'Expandir'}
              </button>
            )}
            
            {/* Botón Ver KWs - solo si tiene keywords */}
            {node.isGroup && keywordCount > 0 && (
              <button
                onClick={onShowKeywords}
                className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
              >
                <IEye size={12}/>
                Ver KWs
              </button>
            )}
            
            {/* Botones de edición */}
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

  const nodeTypes = useMemo(() => {
    if (!ReactFlowComponent) return {};
    return { custom: CustomNode };
  }, []);

  // Generar el grafo de flujo
  const treeToFlow = useMemo(() => {
    const elements = [];

    // LAYOUT HORIZONTAL (como Drawflow)
    const HORIZONTAL_SPACING = 400; // Espaciado entre niveles
    const VERTICAL_SPACING = 150;   // Espaciado entre hermanos

    // Calcular posiciones para cada nivel
    const levelPositions = new Map(); // nivel -> [yPositions usadas]

    const traverse = (node, level = 0, parentId = null) => {
      if (!node) return;

      const nodeId = node.id;
      const isExpanded = expandedNodes.has(nodeId);

      // Inicializar array de posiciones para este nivel
      if (!levelPositions.has(level)) {
        levelPositions.set(level, []);
      }

      // Calcular posición Y para este nodo
      const usedPositions = levelPositions.get(level);
      const yPosition = usedPositions.length * VERTICAL_SPACING;
      usedPositions.push(yPosition);

      // Crear nodo con posición horizontal
      elements.push({
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

      // Crear edge si tiene padre
      if (parentId) {
        elements.push({
          id: `e${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          arrowHeadType: 'arrowclosed',
          style: { stroke: '#8b5cf6', strokeWidth: 2 }
        });
      }

      // SOLO expandir grupos hijos si está expandido
      if (isExpanded && node.isGroup && node.children) {
        const childGroups = node.children.filter(c => c.isGroup);
        childGroups.forEach(child => {
          traverse(child, level + 1, nodeId);
        });
      }
    };

    // Procesar cada árbol raíz
    tree.forEach(node => traverse(node));

    return elements;
  }, [tree, expandedNodes, toggleFlowNode, renameNode, deleteNode, setKeywordModal]);

  // Estado para elementos (nodos + edges en react-flow-renderer v10)
  const [elements, setElements] = useState(treeToFlow);

  // Actualizar elementos cuando cambia el árbol
  useEffect(() => {
    setElements(treeToFlow);
  }, [treeToFlow]);

  // Handler para crear nuevas conexiones (tipo Miro)
  const onConnect = useCallback((params) => {
    console.log('Conectando:', params);

    setElements((els) => {
      // Crear nueva conexión
      const newEdge = {
        id: `e${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        type: 'smoothstep',
        animated: true,
        arrowHeadType: 'arrowclosed',
        style: { stroke: '#10b981', strokeWidth: 3 }
      };

      return [...els, newEdge];
    });
  }, []);

  // Handler para eliminar elementos (conexiones)
  const onElementsRemove = useCallback((elementsToRemove) => {
    console.log('Eliminando elementos:', elementsToRemove);
    setElements((els) => {
      const idsToRemove = new Set(elementsToRemove.map(el => el.id));
      return els.filter(el => !idsToRemove.has(el.id));
    });
  }, []);

  // Handler cuando los nodos son arrastrados (drag and drop)
  const onNodeDragStop = useCallback((event, node) => {
    console.log('Nodo movido:', node.id, 'a posición:', node.position);
  }, []);

  // Handler para cambios en elementos
  const onElementClick = useCallback((event, element) => {
    console.log('Elemento clickeado:', element);
  }, []);

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
      {ReactFlowComponent ? (
        <FlowProvider>
          <ReactFlowComponent
            elements={elements}
            nodeTypes={nodeTypes}
            onConnect={onConnect}
            onElementsRemove={onElementsRemove}
            onNodeDragStop={onNodeDragStop}
            onElementClick={onElementClick}
            deleteKeyCode={46}
            snapToGrid={true}
            snapGrid={[15, 15]}
            connectionLineType="smoothstep"
            connectionLineStyle={{ stroke: '#8b5cf6', strokeWidth: 2 }}
            defaultZoom={1}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            selectNodesOnDrag={false}
            style={{ background: '#fafafa' }}
          >
            {Background && <Background color="#e5e7eb" gap={16}/>}
            {Controls && <Controls showInteractive={false}/>}
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
              • Selecciona y presiona Delete/Supr para eliminar
            </div>
          </ReactFlowComponent>
        </FlowProvider>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-600">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">ReactFlow no está disponible</p>
            <p className="text-sm">Por favor, recarga la página</p>
            <p className="text-xs mt-4 text-gray-500">
              Verifica la consola para más detalles
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

window.FlowView = FlowView;