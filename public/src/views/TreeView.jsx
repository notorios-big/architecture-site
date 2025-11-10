// src/views/TreeView.jsx
const { nodeVolume } = window;
const { IChevronR, IChevronD, IFolderOpen, IEdit, ICheck, IX, ITrash } = window;

const TreeView = ({
  tree,
  dragging,
  dragOver,
  editingId,
  editingText,
  setDragging,
  setDragOver,
  setEditingId,
  setEditingText,
  toggleCollapse,
  renameNode,
  deleteNode,
  onDrop
}) => {
  const Node = ({ node, depth = 0, parentCollapsed = false }) => {
    if (parentCollapsed) return null;
    const isGroup = !!node.isGroup;
    const total = nodeVolume(node);
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} className="mb-3 animate-fade-in" style={{ marginLeft: depth ? '32px' : '0' }}>
        <div
          draggable
          onDragStart={(e) => {
            setDragging(node);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (isGroup && dragging && dragging.id !== node.id) {
              setDragOver(node.id);
            }
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            if (dragging) onDrop(node, dragging);
          }}
          className={`node-card p-4 rounded-xl cursor-move transition-all
            ${isGroup ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200' : 'glass border-2 border-gray-200'}
            ${dragOver === node.id ? 'drag-over border-indigo-500 bg-indigo-50' : ''}`}
        >
          <div className="flex items-center gap-3">
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

        {isGroup && node.children && !node.collapsed && (
          <div className="mt-3 ml-4 border-l-2 border-indigo-200 pl-2">
            {node.children.map(ch => <Node key={ch.id} node={ch} depth={depth + 1} parentCollapsed={false}/>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-2xl overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin animate-fade-in">
      {tree.map(n => <Node key={n.id} node={n}/>)}
    </div>
  );
};

window.TreeView = TreeView;

