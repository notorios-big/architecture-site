// src/views/TreeView.jsx
const { nodeVolume, totalGroupVolume, directGroupVolume } = window;
const { IChevronR, IChevronD, IFolderOpen, IEdit, ICheck, IX, ITrash } = window;
const { useState, useCallback, useMemo, useRef, memo } = React;

// Throttle optimizado con requestAnimationFrame para smoothness
const throttleRAF = (func) => {
  let rafId = null;
  let lastArgs = null;

  return function(...args) {
    lastArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
      });
    }
  };
};

const TreeView = ({
  tree,
  dragging,
  dragOver,
  editingId,
  editingText,
  selectedNodes,
  setDragging,
  setDragOver,
  setEditingId,
  setEditingText,
  toggleNodeSelection,
  toggleCollapse,
  renameNode,
  deleteNode,
  promoteToRoot,
  onDrop
}) => {
  // Optimización: límite de renderizado inicial para listas muy grandes
  const INITIAL_RENDER_LIMIT = 100;
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);

  // Usar refs para evitar re-renders durante el drag
  const dragOverRef = useRef(null);
  const dragElementsRef = useRef(new Map());

  // Actualizar visualmente sin causar re-render
  const updateDragOverVisual = useCallback((nodeId) => {
    // Remover clase del anterior
    if (dragOverRef.current && dragOverRef.current !== nodeId) {
      const prevElement = dragElementsRef.current.get(dragOverRef.current);
      if (prevElement) {
        prevElement.classList.remove('drag-over-active');
      }
    }

    // Agregar clase al nuevo
    if (nodeId) {
      const element = dragElementsRef.current.get(nodeId);
      if (element) {
        element.classList.add('drag-over-active');
      }
    }

    dragOverRef.current = nodeId;
  }, []);

  const clearDragOverVisual = useCallback(() => {
    if (dragOverRef.current) {
      const element = dragElementsRef.current.get(dragOverRef.current);
      if (element) {
        element.classList.remove('drag-over-active');
      }
      dragOverRef.current = null;
    }
  }, []);

  // Throttled con RAF para máximo smoothness
  const throttledUpdateDragOver = useMemo(
    () => throttleRAF(updateDragOverVisual),
    [updateDragOverVisual]
  );

  const Node = memo(({ node, depth = 0, parentCollapsed = false }) => {
    if (parentCollapsed) return null;

    const isGroup = !!node.isGroup;
    // Para grupos: calcular ambos volúmenes
    const totalVol = isGroup ? totalGroupVolume(node) : (node?.volume || 0);
    const ownVol = isGroup ? directGroupVolume(node) : null;
    const isSelected = !isGroup && selectedNodes && selectedNodes.has(node.id);
    const isBeingDragged = dragging && dragging.id === node.id;
    const isMultiDrag = dragging && selectedNodes && selectedNodes.has(dragging.id) && selectedNodes.size > 1;

    const canDrop = isGroup && dragging && dragging.id !== node.id && !isBeingDragged;

    // Ref callback para registrar el elemento
    const cardRef = useCallback((element) => {
      if (element && isGroup) {
        dragElementsRef.current.set(node.id, element);
      }
    }, [node.id, isGroup]);

    return (
      <div key={node.id} className="mb-3" style={{ marginLeft: depth ? '32px' : '0' }}>
        <div
          ref={cardRef}
          draggable={true}
          onDragStart={(e) => {
            setDragging(node);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.id);
          }}
          onDragEnd={() => {
            setDragging(null);
            clearDragOverVisual();
          }}
          onDragOver={(e) => {
            if (!canDrop) return;
            e.preventDefault();
            e.stopPropagation();
            throttledUpdateDragOver(node.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearDragOverVisual();
            if (dragging && canDrop) {
              onDrop(node, dragging);
            }
          }}
          className={`node-card p-4 rounded-xl transition-smooth
            ${isGroup ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200' : 'glass border-2 border-gray-200'}
            ${isBeingDragged ? 'opacity-40 scale-95' : ''}
            ${isSelected ? '!border-purple-500 !bg-purple-50 ring-2 ring-purple-300' : ''}`}
        >
          <div className="flex items-center gap-3">
            {/* Checkbox para keywords (no para grupos) */}
            {!isGroup && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleNodeSelection(node.id, isGroup);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer transition-all"
              />
            )}

            {isGroup && (node.children?.length > 0) && (
              <button onClick={() => toggleCollapse(node.id)}
                      className="p-2 hover:bg-white/50 rounded-lg transition-all">
                {node.collapsed ? <IChevronR size={18}/> : <IChevronD size={18}/>}
              </button>
            )}

            {isGroup && <IFolderOpen size={20} className="text-indigo-600"/>}

            <span className={`flex-1 ${isGroup ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
              {isGroup ? node.name : node.keyword}
              {isBeingDragged && isMultiDrag && (
                <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                  +{selectedNodes.size - 1}
                </span>
              )}
            </span>

            {isGroup && depth > 0 && promoteToRoot && (
                  <button onClick={() => promoteToRoot(node.id)}
                          className="p-2 hover:bg-green-100 rounded-lg transition-all tooltip"
                          data-tooltip="Promover a raíz">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                      <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                  </button>
                )}

            {/* Mostrar volúmenes */}
            {isGroup ? (
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-bold tooltip"
                     data-tooltip="Volumen total (con hijos)">
                  {totalVol.toLocaleString('es-CL')}
                </div>
                <div className="px-3 py-1 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full text-sm font-bold tooltip"
                     data-tooltip="Volumen propio (solo keywords directas)">
                  {ownVol.toLocaleString('es-CL')}
                </div>
              </div>
            ) : (
              <div className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-bold">
                {totalVol.toLocaleString('es-CL')}
              </div>
            )}

            <button onClick={() => deleteNode(node.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-all tooltip"
                    data-tooltip="Eliminar">
              <ITrash size={18} className="text-red-500"/>
            </button>
          </div>
        </div>

        {/* Área de drop mejorada para grupos abiertos */}
        {isGroup && node.children && !node.collapsed && (
          <div
            className="mt-3 ml-4 border-l-2 border-indigo-200 pl-2"
            onDragOver={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              e.stopPropagation();
              throttledUpdateDragOver(node.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearDragOverVisual();
              if (dragging && canDrop) {
                onDrop(node, dragging);
              }
            }}
          >
            {node.children.map(ch => <Node key={ch.id} node={ch} depth={depth + 1} parentCollapsed={false}/>)}
          </div>
        )}
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison para evitar re-renders innecesarios
    return (
      prevProps.node.id === nextProps.node.id &&
      prevProps.node.name === nextProps.node.name &&
      prevProps.node.keyword === nextProps.node.keyword &&
      prevProps.node.collapsed === nextProps.node.collapsed &&
      prevProps.depth === nextProps.depth &&
      prevProps.parentCollapsed === nextProps.parentCollapsed &&
      JSON.stringify(prevProps.node.children?.map(c => c.id)) === JSON.stringify(nextProps.node.children?.map(c => c.id))
    );
  });

  // Memoizar los nodos a renderizar para evitar recálculos
  const visibleNodes = useMemo(() => {
    // Si hay pocos nodos, renderizar todos
    if (tree.length <= INITIAL_RENDER_LIMIT) {
      return tree;
    }
    // De lo contrario, aplicar límite
    return tree.slice(0, renderLimit);
  }, [tree, renderLimit, INITIAL_RENDER_LIMIT]);

  const hasMoreNodes = tree.length > renderLimit;

  return (
    <div className="glass rounded-2xl p-6 shadow-2xl overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin">
      {selectedNodes && selectedNodes.size > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border-2 border-purple-300 rounded-lg flex items-center justify-between">
          <span className="text-purple-800 font-medium">
            {selectedNodes.size} keyword{selectedNodes.size > 1 ? 's' : ''} seleccionada{selectedNodes.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              selectedNodes.forEach(id => toggleNodeSelection(id, false));
            }}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium underline"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Mostrar advertencia de performance si hay muchos grupos */}
      {tree.length > INITIAL_RENDER_LIMIT && renderLimit === INITIAL_RENDER_LIMIT && (
        <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
          <span className="text-yellow-800 text-sm">
            <strong>Optimización de performance:</strong> Mostrando {INITIAL_RENDER_LIMIT} de {tree.length} grupos.
            Los demás grupos están colapsados para mejor rendimiento.
          </span>
        </div>
      )}

      {visibleNodes.map(n => <Node key={n.id} node={n}/>)}

      {/* Botón para cargar más nodos si hay más */}
      {hasMoreNodes && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setRenderLimit(prev => Math.min(prev + 50, tree.length))}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            Cargar más grupos ({tree.length - renderLimit} restantes)
          </button>
        </div>
      )}
    </div>
  );
};

window.TreeView = TreeView;
