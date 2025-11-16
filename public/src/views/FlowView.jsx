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
  promoteToRoot,
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
      deleteNode: (nodeId) => {
        console.log('Delete node:', nodeId);
        if (confirm('¿Eliminar este nodo?')) {
          deleteNode(nodeId);
        }
      },
      promoteToRoot: (nodeId) => {
        console.log('Promote to root:', nodeId);
        if (promoteToRoot) {
          promoteToRoot(nodeId);
        }
      },
      zoomIn: () => {
        if (editorRef.current) {
          editorRef.current.zoom_in();
        }
      },
      zoomOut: () => {
        if (editorRef.current) {
          editorRef.current.zoom_out();
        }
      },
      zoomReset: () => {
        if (editorRef.current) {
          editorRef.current.zoom_reset();
        }
      }
    };

    return () => {
      delete window.flowCallbacks;
    };
  }, [tree, toggleFlowNode, deleteNode, promoteToRoot, setKeywordModal]);

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
  const generateNodeHTML = (node, hasParent = false) => {
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
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 4px;">
          <!-- Header -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>

              <span class="flex-1 text-white font-semibold text-sm" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${nodeName}
              </span>
            </div>

            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              ${hasParent && node.isGroup ? `
                <button
                  onclick="window.flowCallbacks.promoteToRoot('${node.id}')"
                  style="padding: 4px; border-radius: 4px; transition: all 0.2s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.2)'"
                  onmouseout="this.style.background='transparent'"
                  title="Promover a raíz"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </button>
              ` : ''}

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
          </div>

          <!-- Metrics -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: white;">
            <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 16px; font-weight: bold; white-space: nowrap;">
              ${volume.toLocaleString('es-CL')} vol.
            </div>
            ${node.isGroup && keywordCount > 0 ? `
              <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 16px; white-space: nowrap;">
                ${keywordCount} KWs
              </div>
            ` : ''}
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 6px; align-items: center;">
            ${hasChildGroups ? `
              <button
                onclick="window.flowCallbacks.toggleNode('${node.id}')"
                style="flex: 1; padding: 6px 10px; background: rgba(255,255,255,0.2); border-radius: 6px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; min-height: 32px;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
              >
                ${isExpanded ? '▼ Contraer' : '▶ Expandir'}
              </button>
            ` : ''}

            ${node.isGroup && keywordCount > 0 ? `
              <button
                onclick="window.flowCallbacks.showKeywords('${node.id}')"
                style="flex: 1; padding: 6px 10px; background: rgba(255,255,255,0.2); border-radius: 6px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; min-height: 32px;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
              >
                👁 Ver KWs
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

      // ========== CONFIGURACIONES AVANZADAS DE DRAWFLOW ==========
      // Habilitar reroute para conexiones más flexibles
      editor.reroute = true;

      // Configurar curvaturas para conexiones más suaves y profesionales
      editor.reroute_fix_curvature = true;
      editor.curvature = 0.5;              // Curvatura general de las conexiones
      editor.reroute_curvature = 0.5;      // Curvatura de los puntos de reroute
      editor.reroute_curvature_start_end = 0.5; // Curvatura en inicio y fin

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

      // ========== CONFIGURACIÓN DEL LAYOUT ==========
      const HORIZONTAL_SPACING = 600;  // Aumentado para mejor espaciado
      const VERTICAL_SPACING = 250;    // Aumentado para mejor espaciado
      const NODE_WIDTH = HORIZONTAL_SPACING;
      const TREE_SPACING = 200;        // Espacio extra entre árboles raíz

      // ========== ALGORITMO DE LAYOUT DE ÁRBOL (Reingold-Tilford) ==========

      // Estructura para almacenar información de layout de cada nodo
      const nodeLayoutInfo = new Map();
      const nodeIdMap = new Map();
      const connections = [];

      // Paso 1: Construir estructura de árbol con información de hijos expandidos
      const buildTreeStructure = (node, parentId = null) => {
        if (!node) return null;

        const isExpanded = expandedNodes.has(node.id);
        const childGroups = (node.isGroup && node.children)
          ? node.children.filter(c => c.isGroup)
          : [];

        const treeNode = {
          id: node.id,
          node: node,
          parentId: parentId,
          children: [],
          width: 1,  // Ancho en unidades de nodos
          x: 0,
          y: 0,
          mod: 0,    // Modificador para el algoritmo Reingold-Tilford
          thread: null,
          ancestor: null,
          change: 0,
          shift: 0,
          prelim: 0
        };

        // Solo incluir hijos si el nodo está expandido
        if (isExpanded && childGroups.length > 0) {
          treeNode.children = childGroups
            .map(child => buildTreeStructure(child, node.id))
            .filter(c => c !== null);
        }

        return treeNode;
      };

      // Paso 2: Calcular el ancho de cada subárbol
      const calculateSubtreeWidths = (treeNode) => {
        if (!treeNode) return 1;

        if (treeNode.children.length === 0) {
          treeNode.width = 1;
          return 1;
        }

        treeNode.width = treeNode.children.reduce((sum, child) => {
          return sum + calculateSubtreeWidths(child);
        }, 0);

        return treeNode.width;
      };

      // Paso 3: Algoritmo Reingold-Tilford para posicionamiento
      const firstWalk = (treeNode, leftSibling = null) => {
        if (treeNode.children.length === 0) {
          // Nodo hoja
          if (leftSibling) {
            treeNode.prelim = leftSibling.prelim + 1;
          } else {
            treeNode.prelim = 0;
          }
        } else {
          // Nodo interno
          let defaultAncestor = treeNode.children[0];

          for (let i = 0; i < treeNode.children.length; i++) {
            const child = treeNode.children[i];
            firstWalk(child, i > 0 ? treeNode.children[i - 1] : null);
            defaultAncestor = apportion(child, defaultAncestor);
          }

          executeShifts(treeNode);

          const midpoint = (treeNode.children[0].prelim + treeNode.children[treeNode.children.length - 1].prelim) / 2;

          if (leftSibling) {
            treeNode.prelim = leftSibling.prelim + 1;
            treeNode.mod = treeNode.prelim - midpoint;
          } else {
            treeNode.prelim = midpoint;
          }
        }

        return treeNode;
      };

      const apportion = (v, defaultAncestor) => {
        const w = getPreviousSibling(v);
        if (w) {
          let vip = v;
          let vop = v;
          let vim = w;
          let vom = getLeftmost(vip);

          let sip = vip.mod;
          let sop = vop.mod;
          let sim = vim.mod;
          let som = vom.mod;

          while (nextRight(vim) && nextLeft(vip)) {
            vim = nextRight(vim);
            vip = nextLeft(vip);
            vom = nextLeft(vom);
            vop = nextRight(vop);
            vop.ancestor = v;

            const shift = (vim.prelim + sim) - (vip.prelim + sip) + 1;
            if (shift > 0) {
              moveSubtree(ancestor(vim, v, defaultAncestor), v, shift);
              sip += shift;
              sop += shift;
            }

            sim += vim.mod;
            sip += vip.mod;
            som += vom.mod;
            sop += vop.mod;
          }

          if (nextRight(vim) && !nextRight(vop)) {
            vop.thread = nextRight(vim);
            vop.mod += sim - sop;
          }

          if (nextLeft(vip) && !nextLeft(vom)) {
            vom.thread = nextLeft(vip);
            vom.mod += sip - som;
            defaultAncestor = v;
          }
        }
        return defaultAncestor;
      };

      const nextLeft = (node) => {
        return node.children.length > 0 ? node.children[0] : node.thread;
      };

      const nextRight = (node) => {
        return node.children.length > 0 ? node.children[node.children.length - 1] : node.thread;
      };

      const getPreviousSibling = (node) => {
        if (!node.parentId) return null;
        const parent = nodeLayoutInfo.get(node.parentId);
        if (!parent) return null;
        const index = parent.children.indexOf(node);
        return index > 0 ? parent.children[index - 1] : null;
      };

      const getLeftmost = (node) => {
        return node.children.length > 0 ? node.children[0] : node;
      };

      const ancestor = (vim, v, defaultAncestor) => {
        if (vim.ancestor && v.parentId === vim.ancestor.parentId) {
          return vim.ancestor;
        }
        return defaultAncestor;
      };

      const moveSubtree = (wm, wp, shift) => {
        const subtrees = wp.prelim - wm.prelim;
        if (subtrees === 0) return;

        wp.change -= shift / subtrees;
        wp.shift += shift;
        wm.change += shift / subtrees;
        wp.prelim += shift;
        wp.mod += shift;
      };

      const executeShifts = (node) => {
        let shift = 0;
        let change = 0;
        for (let i = node.children.length - 1; i >= 0; i--) {
          const child = node.children[i];
          child.prelim += shift;
          child.mod += shift;
          change += child.change;
          shift += child.shift + change;
        }
      };

      const secondWalk = (treeNode, m = 0, depth = 0) => {
        treeNode.x = treeNode.prelim + m;
        treeNode.y = depth;

        nodeLayoutInfo.set(treeNode.id, treeNode);

        for (const child of treeNode.children) {
          secondWalk(child, m + treeNode.mod, depth + 1);
        }
      };

      // Paso 4: Aplicar el layout a cada árbol raíz
      const layoutTrees = (roots) => {
        let globalOffsetX = 0;

        roots.forEach((rootNode, rootIndex) => {
          // Construir estructura de árbol
          const treeRoot = buildTreeStructure(rootNode.node);
          if (!treeRoot) return;

          // Calcular anchos
          calculateSubtreeWidths(treeRoot);

          // Aplicar Reingold-Tilford
          firstWalk(treeRoot);
          secondWalk(treeRoot, globalOffsetX, 0);

          // Actualizar offset para el siguiente árbol
          globalOffsetX += treeRoot.width + (TREE_SPACING / NODE_WIDTH);
        });
      };

      // Paso 5: Crear nodos en Drawflow con las posiciones calculadas
      const createNodesAndConnections = () => {
        console.log('\n📍 Creando nodos con posiciones calculadas...');

        nodeLayoutInfo.forEach((layoutNode, nodeId) => {
          const node = layoutNode.node;

          // Convertir posiciones del layout a coordenadas de píxeles
          const xPosition = layoutNode.x * NODE_WIDTH + 100;
          const yPosition = layoutNode.y * VERTICAL_SPACING + 100;

          const html = generateNodeHTML(node, layoutNode.parentId !== null);

          const drawflowId = editor.addNode(
            `node-${node.id}`,
            1,
            1,
            xPosition,
            yPosition,
            `node-${node.id}`,
            {},
            html
          );

          nodeIdMap.set(node.id, drawflowId);

          console.log(`  → Nodo ${node.name || node.keyword} en (${xPosition.toFixed(0)}, ${yPosition.toFixed(0)})`);

          // Guardar conexión si tiene padre
          if (layoutNode.parentId !== null) {
            connections.push({
              from: layoutNode.parentId,
              to: node.id
            });
          }
        });
      };

      // ========== EJECUTAR ALGORITMO DE LAYOUT ==========

      // Preparar datos para el layout
      const rootNodes = tree.map(node => ({ node }));

      // PASO 1: Calcular layout con algoritmo Reingold-Tilford
      console.log('\n📍 PASO 1: Calculando layout con algoritmo Reingold-Tilford...');
      layoutTrees(rootNodes);

      // PASO 2: Crear todos los nodos con posiciones calculadas
      console.log('\n📍 PASO 2: Creando nodos con posiciones calculadas...');
      createNodesAndConnections();

      // PASO 3: Crear todas las conexiones (activar flag para ignorar eventos)
      console.log(`\n🔗 PASO 3: Creando ${connections.length} conexiones...`);
      isRenderingRef.current = true; // Activar flag de renderizado
      connections.forEach(conn => {
        try {
          const fromDrawflowId = nodeIdMap.get(conn.from);
          const toDrawflowId = nodeIdMap.get(conn.to);

          if (fromDrawflowId && toDrawflowId) {
            const success = editor.addConnection(
              fromDrawflowId,
              toDrawflowId,
              'output_1',
              'input_1'
            );
            console.log(`  ✓ Conexión creada: ${conn.from} -> ${conn.to} - Success: ${success}`);
          } else {
            console.error(`  ✗ No se encontraron IDs de Drawflow para ${conn.from} -> ${conn.to}`);
          }
        } catch (err) {
          console.error(`  ✗ Error al crear conexión ${conn.from} -> ${conn.to}:`, err);
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
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Drawflow se renderiza aquí */}
      </div>

      {/* Controles de zoom */}
      <div style={{
        position: 'absolute',
        left: '20px',
        bottom: '20px',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={() => window.flowCallbacks?.zoomOut()}
          style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Alejar"
        >
          −
        </button>

        <button
          onClick={() => window.flowCallbacks?.zoomReset()}
          style={{
            height: '40px',
            padding: '0 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Restablecer zoom"
        >
          100%
        </button>

        <button
          onClick={() => window.flowCallbacks?.zoomIn()}
          style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Acercar"
        >
          +
        </button>
      </div>

      {/* Controles de ayuda */}
      <div style={{
        position: 'absolute',
        right: '20px',
        top: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        fontSize: '12px',
        zIndex: 10,
        maxWidth: '220px',
        backdropFilter: 'blur(10px)'
      }}>
        <strong style={{ fontSize: '13px', color: '#333' }}>💡 Controles:</strong><br/>
        <div style={{ marginTop: '8px', lineHeight: '1.6', color: '#555' }}>
          • Arrastra nodos para moverlos<br/>
          • Clic en Expandir para ver subgrupos<br/>
          • Usa los botones +/− para zoom<br/>
          • Arrastra el canvas para desplazarte
        </div>
      </div>
    </div>
  );
};

window.FlowView = FlowView;
