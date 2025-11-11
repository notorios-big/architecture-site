// src/views/FlowView.jsx
const { useState, useEffect, useRef } = React;
const { nodeVolume } = window;
const {
  IFolderOpen, ITrash, IEdit, ICheck, IChevronR, IChevronD, IEye
} = window;

const FlowView = ({
  tree,
  expandedNodes,
  toggleFlowNode,
  renameNode,
  deleteNode,
  setKeywordModal,
  onMoveNode
}) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [isDrawflowReady, setIsDrawflowReady] = useState(false);
  const isRenderingRef = useRef(false); // Flag para indicar si estamos renderizando

  // Verificar que Drawflow esté disponible
  useEffect(() => {
    console.log('Drawflow disponible:', typeof window.Drawflow !== 'undefined');

    if (typeof window.Drawflow === 'undefined') {
      console.error('Drawflow no está cargado. Verifica el CDN.');
      return;
    }

    setIsDrawflowReady(true);
  }, []);

  // Exponer callbacks globalmente para que el HTML los pueda usar
  useEffect(() => {
    window.flowCallbacks = {
      toggleNode: (nodeId) => {
        console.log('Toggle node:', nodeId);
        toggleFlowNode(nodeId);
      },
      showKeywords: (nodeId) => {
        console.log('Show keywords:', nodeId);
        const node = findNodeById(tree, nodeId);
        if (node) setKeywordModal(node);
      },
      startEdit: (nodeId) => {
        console.log('Start edit:', nodeId);
        const input = document.getElementById(`edit-input-${nodeId}`);
        const display = document.getElementById(`display-name-${nodeId}`);
        const editBtn = document.getElementById(`edit-btn-${nodeId}`);
        const saveBtn = document.getElementById(`save-btn-${nodeId}`);

        if (input && display && editBtn && saveBtn) {
          input.classList.remove('hidden');
          display.classList.add('hidden');
          editBtn.classList.add('hidden');
          saveBtn.classList.remove('hidden');
          input.focus();
        }
      },
      saveEdit: (nodeId) => {
        console.log('Save edit:', nodeId);
        const input = document.getElementById(`edit-input-${nodeId}`);
        if (input && input.value.trim()) {
          renameNode(nodeId, input.value.trim());
        }
        window.flowCallbacks.cancelEdit(nodeId);
      },
      cancelEdit: (nodeId) => {
        const input = document.getElementById(`edit-input-${nodeId}`);
        const display = document.getElementById(`display-name-${nodeId}`);
        const editBtn = document.getElementById(`edit-btn-${nodeId}`);
        const saveBtn = document.getElementById(`save-btn-${nodeId}`);

        if (input && display && editBtn && saveBtn) {
          input.classList.add('hidden');
          display.classList.remove('hidden');
          editBtn.classList.remove('hidden');
          saveBtn.classList.add('hidden');
        }
      },
      deleteNode: (nodeId) => {
        console.log('Delete node:', nodeId);
        if (confirm('¿Eliminar este nodo?')) {
          deleteNode(nodeId);
        }
      }
    };

    return () => {
      delete window.flowCallbacks;
    };
  }, [tree, toggleFlowNode, renameNode, deleteNode, setKeywordModal]);

  // Función auxiliar para encontrar un nodo por ID
  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Generar HTML para un nodo
  const generateNodeHTML = (node) => {
    const volume = nodeVolume(node);
    const isExpanded = expandedNodes.has(node.id);

    const childGroups = node.isGroup && node.children
      ? node.children.filter(c => c.isGroup)
      : [];
    const hasChildGroups = childGroups.length > 0;

    const keywordCount = node.isGroup && node.children
      ? node.children.filter(c => !c.isGroup).length
      : 0;

    const nodeName = node.name || node.keyword || 'Sin nombre';

    return `
      <div class="custom-node">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>

            <input
              id="edit-input-${node.id}"
              type="text"
              value="${nodeName}"
              class="hidden flex-1 px-2 py-1 text-sm border border-white rounded bg-white/20 text-white placeholder-white/70"
              onkeydown="if(event.key==='Enter') window.flowCallbacks.saveEdit('${node.id}'); if(event.key==='Escape') window.flowCallbacks.cancelEdit('${node.id}');"
            />

            <span id="display-name-${node.id}" class="flex-1 text-white font-semibold text-sm" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${nodeName}
            </span>

            <button
              onclick="window.flowCallbacks.deleteNode('${node.id}')"
              style="padding: 4px; border-radius: 4px; transition: all 0.2s;"
              onmouseover="this.style.background='rgba(255,255,255,0.2)'"
              onmouseout="this.style.background='transparent'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>

          <!-- Metrics -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: white;">
            <div style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 16px; font-weight: bold;">
              ${volume.toLocaleString('es-CL')} vol.
            </div>
            ${node.isGroup && keywordCount > 0 ? `
              <div style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 16px;">
                ${keywordCount} KWs
              </div>
            ` : ''}
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 4px;">
            ${hasChildGroups ? `
              <button
                onclick="window.flowCallbacks.toggleNode('${node.id}')"
                style="flex: 1; padding: 4px 8px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px; border: none; cursor: pointer;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'"
              >
                ${isExpanded ? '▼ Contraer' : '▶ Expandir'}
              </button>
            ` : ''}

            ${node.isGroup && keywordCount > 0 ? `
              <button
                onclick="window.flowCallbacks.showKeywords('${node.id}')"
                style="flex: 1; padding: 4px 8px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px; border: none; cursor: pointer;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'"
              >
                👁 Ver KWs
              </button>
            ` : ''}

            ${node.isGroup ? `
              <button
                id="edit-btn-${node.id}"
                onclick="window.flowCallbacks.startEdit('${node.id}')"
                style="padding: 4px 8px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; transition: all 0.2s; border: none; cursor: pointer;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 21.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>

              <button
                id="save-btn-${node.id}"
                onclick="window.flowCallbacks.saveEdit('${node.id}')"
                class="hidden"
                style="padding: 4px 8px; background: #10b981; border-radius: 4px; color: white; transition: all 0.2s; border: none; cursor: pointer;"
                onmouseover="this.style.background='#059669'"
                onmouseout="this.style.background='#10b981'"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  };

  // Inicializar y actualizar Drawflow
  useEffect(() => {
    if (!isDrawflowReady || !containerRef.current) return;

    console.log('Inicializando Drawflow...');
    console.log('expandedNodes:', Array.from(expandedNodes));

    // Limpiar editor anterior si existe
    if (editorRef.current) {
      try {
        console.log('Limpiando editor anterior...');
        editorRef.current.clear();
        editorRef.current = null;
      } catch (e) {
        console.error('Error al limpiar editor:', e);
      }
    }

    // Limpiar contenedor
    containerRef.current.innerHTML = '';

    // Crear elemento para Drawflow
    const drawflowDiv = document.createElement('div');
    drawflowDiv.id = 'drawflow';
    containerRef.current.appendChild(drawflowDiv);

    // Inicializar Drawflow
    try {
      const editor = new Drawflow(drawflowDiv);
      editor.reroute = true;
      editor.start();

      editorRef.current = editor;

      console.log('Drawflow inicializado correctamente');

      // Event listeners para capturar conexiones manuales del usuario
      editor.on('connectionCreated', (info) => {
        // Si estamos renderizando, ignorar el evento (es una conexión programática)
        if (isRenderingRef.current) {
          console.log('🔗 Conexión programática ignorada:', info);
          return;
        }

        console.log('🔗 Conexión creada manualmente por usuario:', info);

        // info contiene: { output_id, input_id, output_class, input_class }
        // Necesitamos obtener los node.id originales de los nodos de Drawflow

        const outputNode = editor.drawflow.drawflow.Home.data[info.output_id];
        const inputNode = editor.drawflow.drawflow.Home.data[info.input_id];

        if (outputNode && inputNode) {
          // El name del nodo tiene formato "node-{id}", extraemos el id original
          const sourceId = outputNode.name?.replace('node-', '');
          const targetId = inputNode.name?.replace('node-', '');

          console.log(`  → Moviendo nodo ${targetId} como hijo de ${sourceId}`);

          if (sourceId && targetId && onMoveNode) {
            // Llamar a onMoveNode para actualizar el árbol
            onMoveNode(targetId, sourceId);
          }
        }
      });

      editor.on('connectionRemoved', (info) => {
        console.log('🔗❌ Conexión eliminada:', info);
        // Por ahora solo logueamos, podrías implementar lógica para desconectar nodos
      });

      // Construir el diagrama
      const HORIZONTAL_SPACING = 400;
      const VERTICAL_SPACING = 150;
      const levelPositions = new Map();
      const nodeIdMap = new Map(); // Mapeo de node.id a drawflow node id
      const connections = []; // Array para guardar las conexiones a crear

      const traverse = (node, level = 0, parentId = null) => {
        if (!node) return;

        const isExpanded = expandedNodes.has(node.id);

        console.log(`Procesando nodo: ${node.name || node.keyword}, Level: ${level}, Parent: ${parentId}, Expanded: ${isExpanded}`);

        // Calcular posición
        if (!levelPositions.has(level)) {
          levelPositions.set(level, []);
        }

        const usedPositions = levelPositions.get(level);
        const yPosition = usedPositions.length * VERTICAL_SPACING + 50;
        usedPositions.push(yPosition);

        const xPosition = level * HORIZONTAL_SPACING + 50;

        // Generar HTML del nodo
        const html = generateNodeHTML(node);

        // Agregar nodo a Drawflow y capturar el ID real que devuelve
        const currentDrawflowId = editor.addNode(
          `node-${node.id}`,  // name
          1,                   // inputs - tiene 1 input para poder conectar
          1,                   // outputs
          xPosition,
          yPosition,
          `node-${node.id}`,  // class
          {},                  // data
          html                 // html
        );

        nodeIdMap.set(node.id, currentDrawflowId);

        console.log(`  → Nodo agregado con Drawflow ID: ${currentDrawflowId} en posición (${xPosition}, ${yPosition})`);

        // Guardar la conexión para crearla después
        if (parentId !== null) {
          const parentDrawflowId = nodeIdMap.get(parentId);
          connections.push({
            from: parentDrawflowId,
            to: currentDrawflowId,
            parentName: parentId,
            childName: node.id
          });
          console.log(`  → Conexión pendiente: ${parentDrawflowId} -> ${currentDrawflowId}`);
        }

        // Procesar hijos si está expandido
        if (node.isGroup && node.children) {
          const childGroups = node.children.filter(c => c.isGroup);
          console.log(`  → Tiene ${childGroups.length} grupos hijos`);

          if (isExpanded && childGroups.length > 0) {
            console.log(`  → Procesando hijos porque está expandido`);
            childGroups.forEach(child => {
              traverse(child, level + 1, node.id);
            });
          } else if (!isExpanded && childGroups.length > 0) {
            console.log(`  → NO procesando hijos porque NO está expandido`);
          }
        }
      };

      // PASO 1: Procesar todos los nodos raíz y agregar todos los nodos
      console.log('\n📍 PASO 1: Agregando todos los nodos...');
      tree.forEach(node => traverse(node));

      // PASO 2: Crear todas las conexiones (activar flag para ignorar eventos)
      console.log(`\n🔗 PASO 2: Creando ${connections.length} conexiones...`);
      isRenderingRef.current = true; // Activar flag de renderizado
      connections.forEach(conn => {
        try {
          const success = editor.addConnection(
            conn.from,       // output_id
            conn.to,         // input_id
            'output_1',      // output_class
            'input_1'        // input_class
          );
          console.log(`  ✓ Conexión creada: ${conn.from} -> ${conn.to} (${conn.parentName} -> ${conn.childName}) - Success: ${success}`);
        } catch (err) {
          console.error(`  ✗ Error al crear conexión ${conn.from} -> ${conn.to}:`, err);
          console.error(`     Nodo ${conn.from} existe:`, !!editor.drawflow.drawflow.Home.data[conn.from]);
          console.error(`     Nodo ${conn.to} existe:`, !!editor.drawflow.drawflow.Home.data[conn.to]);
        }
      });

      // Desactivar flag de renderizado
      isRenderingRef.current = false;

      // Contar nodos y conexiones totales
      const totalNodes = Object.keys(editor.drawflow.drawflow.Home.data).length;
      const totalConnections = Object.keys(editor.drawflow.drawflow.Home.data).reduce((sum, key) => {
        const node = editor.drawflow.drawflow.Home.data[key];
        return sum + Object.keys(node.outputs?.output_1?.connections || {}).length;
      }, 0);

      console.log(`\n📊 Resumen:`);
      console.log(`Total de nodos agregados: ${totalNodes}`);
      console.log(`Total de conexiones: ${totalConnections}`);
      console.log(`Nodos en el drawflow:`, editor.drawflow.drawflow.Home.data);
      console.log(`\n✅ Renderizado completo. Ahora puedes crear conexiones manualmente.`);

    } catch (err) {
      console.error('Error al inicializar Drawflow:', err);
    }

    // Cleanup
    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.clear();
        } catch (e) {
          console.error('Error al limpiar Drawflow:', e);
        }
      }
    };
  }, [tree, expandedNodes, isDrawflowReady]);

  if (!isDrawflowReady) {
    return (
      <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="flex items-center justify-center h-full text-gray-600">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Cargando Drawflow...</p>
            <p className="text-sm">Por favor espera un momento</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Drawflow se renderiza aquí */}
      </div>

      {/* Controles de ayuda */}
      <div style={{
        position: 'absolute',
        right: '10px',
        top: '10px',
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '12px',
        zIndex: 5,
        maxWidth: '200px'
      }}>
        <strong>💡 Controles:</strong><br/>
        • Arrastra nodos para moverlos<br/>
        • Haz clic en Expandir para ver subgrupos<br/>
        • Usa la rueda del mouse para zoom<br/>
        • Arrastra el canvas para desplazarte
      </div>
    </div>
  );
};

window.FlowView = FlowView;
