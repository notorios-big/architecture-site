// src/views/TreeView.jsx
const { nodeVolume } = window;
const { IChevronR, IChevronD, IFolderOpen, IEdit, ICheck, IX, ITrash } = window;

// Throttle helper para optimizar rendimiento
const throttle = (func, delay) => {
  let lastCall = 0;
  let timeoutId = null;
  return function(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
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
  onDrop
}) => {
  // Throttled version de setDragOver para mejor rendimiento
  const throttledSetDragOver = React.useMemo(
    () => throttle((nodeId) => setDragOver(nodeId), 50),
    [setDragOver]
  );

  const Node = ({ node, depth = 0, parentCollapsed = false }) => {
    if (parentCollapsed) return null;
    const isGroup = !!node.isGroup;
    const total = nodeVolume(node);
    const isEditing = editingId === node.id;
    const isSelected = !isGroup && selectedNodes && selectedNodes.has(node.id);
    const isBeingDragged = dragging && dragging.id === node.id;
    const isMultiDrag = dragging && selectedNodes && selectedNodes.has(dragging.id) && selectedNodes.size > 1;

    // Calcular si este grupo está recibiendo un drop
    const isDragTarget = dragOver === node.id;
    const canDrop = isGroup && dragging && dragging.id !== node.id && !isBeingDragged;

    return (
      <div key={node.id} className="mb-3 animate-fade-in" style={{ marginLeft: depth ? '32px' : '0' }}>
        <div
          draggable={!isEditing}
          onDragStart={(e) => {
            if (isEditing) {
              e.preventDefault();
              return;
            }
            setDragging(node);
            e.dataTransfer.effectAllowed = 'move';
            // Añadir feedback visual
            e.dataTransfer.setData('text/plain', node.id);
          }}
          onDragEnd={() => {
            setDragging(null);
            setDragOver(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canDrop) {
              throttledSetDragOver(node.id);
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            // Solo limpiar si realmente salimos del elemento
            if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
              setDragOver(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(null);
            if (dragging && canDrop) {
              onDrop(node, dragging);
            }
          }}
          className={`node-card p-4 rounded-xl transition-all
            ${isGroup ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200' : 'glass border-2 border-gray-200'}
            ${isDragTarget ? 'drag-over !border-indigo-500 !bg-indigo-100 shadow-lg scale-[1.02]' : ''}
            ${isBeingDragged ? 'opacity-50 cursor-grabbing' : 'cursor-move'}
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

            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="flex-1 px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameNode(node.id, editingText);
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                />
                <button onClick={() => {
                  renameNode(node.id, editingText);
                  setEditingId(null);
                }}
                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all tooltip"
                        data-tooltip="Guardar">
                  <ICheck size={18}/>
                </button>
                <button onClick={() => setEditingId(null)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all tooltip"
                        data-tooltip="Cancelar">
                  <IX size={18}/>
                </button>
              </div>
            ) : (
              <>
                <span className={`flex-1 ${isGroup ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                  {isGroup ? node.name : node.keyword}
                  {isBeingDragged && isMultiDrag && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                      +{selectedNodes.size - 1}
                    </span>
                  )}
                </span>
                {isGroup && (
                  <button onClick={() => {
                    setEditingId(node.id);
                    setEditingText(node.name || '');
                  }}
                          className="p-2 hover:bg-white/50 rounded-lg transition-all tooltip"
                          data-tooltip="Editar nombre">
                    <IEdit size={18} className="text-indigo-600"/>
                  </button>
                )}
              </>
            )}

            <div className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-bold">
              {total.toLocaleString('es-CL')}
            </div>

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
            className={`mt-3 ml-4 border-l-2 border-indigo-200 pl-2 transition-all
              ${canDrop && !isDragTarget ? 'drop-zone-expanded' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Permitir drop en el área de children del grupo abierto
              if (canDrop) {
                throttledSetDragOver(node.id);
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDragOver(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(null);
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
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-2xl overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin animate-fade-in">
      {selectedNodes && selectedNodes.size > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border-2 border-purple-300 rounded-lg flex items-center justify-between">
          <span className="text-purple-800 font-medium">
            {selectedNodes.size} keyword{selectedNodes.size > 1 ? 's' : ''} seleccionada{selectedNodes.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              // Limpiar todas las selecciones
              const emptySet = new Set();
              selectedNodes.forEach(id => toggleNodeSelection(id, false));
            }}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium underline"
          >
            Limpiar selección
          </button>
        </div>
      )}
      {tree.map(n => <Node key={n.id} node={n}/>)}
    </div>
  );
};

window.TreeView = TreeView;
