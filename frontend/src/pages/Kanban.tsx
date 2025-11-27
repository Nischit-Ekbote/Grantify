import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Edit2, Check, GripVertical, Loader2 } from 'lucide-react';
import { kanbanApi, type Task } from '../api/kanbanApi';

interface TasksState {
  todo: Task[];
  active: Task[];
  completed: Task[];
}

type ColumnId = keyof TasksState;

interface Column {
  id: ColumnId;
  title: string;
  color: string;
}

interface SortableTaskProps {
  task: Task;
  columnId: ColumnId;
  onEdit: (task: Task) => void;
  onDelete: (columnId: ColumnId, taskId: string) => void;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  saveEdit: (columnId: ColumnId, taskId: string) => void;
}

const SortableTask: React.FC<SortableTaskProps> = ({
  task,
  columnId,
  onEdit,
  onDelete,
  isEditing,
  editText,
  setEditText,
  saveEdit,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border border-gray-600 ${
        isDragging ? 'shadow-lg ring-2 ring-purple-500' : ''
      }`}
    >
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && saveEdit(columnId, task.taskId)}
            className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            autoFocus
          />
          <button
            onClick={() => saveEdit(columnId, task.taskId)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            <Check size={18} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div {...listeners} {...attributes} className="mt-1 cursor-grab active:cursor-grabbing">
            <GripVertical size={18} className="text-gray-400" />
          </div>
          <p className="text-gray-100 flex-1">{task.text}</p>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(task)}
              className="text-blue-400 hover:text-blue-300"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDelete(columnId, task.taskId)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children }) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className="p-4 min-h-[500px] space-y-3 bg-gray-800/50">
      {children}
    </div>
  );
};

const KanbanBoard: React.FC = () => {
  const [tasks, setTasks] = useState<TasksState>({
    todo: [],
    active: [],
    completed: []
  });
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns: Column[] = [
    { id: 'todo', title: 'To Do', color: 'bg-purple-800' },
    { id: 'active', title: 'Active', color: 'bg-blue-400' },
    { id: 'completed', title: 'Completed', color: 'bg-[#8cb369]' }
  ];

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const tasksData = await kanbanApi.getAllTasks();
      setTasks(tasksData);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (): Promise<void> => {
    if (!newTaskText.trim()) return;

    try {
      const newTask = await kanbanApi.createTask(newTaskText.trim());
      setTasks(prev => ({
        ...prev,
        todo: [...prev.todo, newTask]
      }));
      setNewTaskText('');
      setShowAddModal(false);
    } catch (err) {
      setError('Failed to create task. Please try again.');
      console.error('Error creating task:', err);
    }
  };

  const deleteTask = async (columnId: ColumnId, taskId: string): Promise<void> => {
    try {
      await kanbanApi.deleteTask(taskId);
      setTasks(prev => ({
        ...prev,
        [columnId]: prev[columnId].filter(task => task.taskId !== taskId)
      }));
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err);
    }
  };

  const startEdit = (task: Task): void => {
    setEditingTask(task.taskId);
    setEditText(task.text);
  };

  const saveEdit = async (columnId: ColumnId, taskId: string): Promise<void> => {
    if (!editText.trim()) return;

    try {
      await kanbanApi.updateTask(taskId, { text: editText.trim() });
      setTasks(prev => ({
        ...prev,
        [columnId]: prev[columnId].map(task =>
          task.taskId === taskId ? { ...task, text: editText.trim() } : task
        )
      }));
      setEditingTask(null);
      setEditText('');
    } catch (err) {
      setError('Failed to update task. Please try again.');
      console.error('Error updating task:', err);
    }
  };

  const findContainer = (id: string): ColumnId | undefined => {
    if (id in tasks) {
      return id as ColumnId;
    }
    return Object.keys(tasks).find(key => 
      tasks[key as ColumnId].find(task => task.taskId === id)
    ) as ColumnId | undefined;
  };

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent): void => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    let overContainer: ColumnId | undefined;
    
    if (over.id === 'todo' || over.id === 'active' || over.id === 'completed') {
      overContainer = over.id as ColumnId;
    } else {
      overContainer = findContainer(over.id as string);
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setTasks(prev => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex(task => task.taskId === active.id);
      const overIndex = overItems.findIndex(task => task.taskId === over.id);

      let newIndex: number;
      if (over.id in prev) {
        newIndex = overItems.length;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
      }

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter(task => task.taskId !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          { ...activeItems[activeIndex], column: overContainer },
          ...prev[overContainer].slice(newIndex),
        ],
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const containerId : string = (over.data.current?.sortable.containerId);

    const getId = {
      'Sortable-0' : 'todo',
      'Sortable-2' : 'active',
      'Sortable-4' : 'completed'
    } as const;

    const id = getId[containerId as keyof typeof getId];

    const activeContainer = findContainer(active.id as string);
    let overContainer: ColumnId | undefined;
    
    if (id === 'todo' || id === 'active' || id === 'completed') {
      overContainer = id as ColumnId;
    } else {
      overContainer = findContainer(id as string);
    }

    if (!activeContainer || !overContainer) {
      setActiveId(null);
      return;
    }

    await kanbanApi.updateTask(active.id as string, { column: overContainer });

      const activeIndex = tasks[activeContainer].findIndex(task => task.taskId === active.id);
      const overIndex = tasks[overContainer].findIndex(task => task.taskId === over.id);
      
      if (activeIndex !== overIndex && overIndex !== -1) {
        setTasks(prev => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }));
      }
    

    setActiveId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-purple-500" size={48} />
          <p className="text-gray-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Kanban Board
            </h1>
            <p className="text-gray-400">Drag and drop tasks between columns</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-800 text-white px-6 py-3 rounded-lg hover:bg-purple-900 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Plus size={20} />
            Add Task
          </button>
        </div>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 max-w-md mx-auto backdrop-blur-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-200 hover:text-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        {/* Add Task Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 "
              onClick={() => setShowAddModal(false)}
            />
            <div className="relative bg-gray-800/10 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-700 backdrop-blur-lg">
              <h3 className="text-2xl font-bold text-white mb-4">Add New Task</h3>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Enter task description..."
                className="w-full px-4 py-3  border-gray-600 rounded-lg  focus:outline-none focus:ring-2 ring-amber-100 focus:ring-purple-800 text-white placeholder-gray-400 mb-4"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTaskText('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  className="bg-purple-800 text-white px-6 py-2 rounded-lg hover:bg-purple-900 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {columns.map(column => (
              <div key={column.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                <div className={`${column.color} text-white p-4 flex justify-between items-center`}>
                  <h2 className="text-lg font-semibold">{column.title}</h2>
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                    {tasks[column.id].length}
                  </span>
                </div>
                
                <SortableContext
                  items={tasks[column.id].map(task => task.taskId)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn id={column.id}>
                    {tasks[column.id].map(task => (
                      <SortableTask
                        key={task.taskId}
                        task={task}
                        columnId={column.id}
                        onEdit={startEdit}
                        onDelete={deleteTask}
                        isEditing={editingTask === task.taskId}
                        editText={editText}
                        setEditText={setEditText}
                        saveEdit={saveEdit}
                      />
                    ))}
                  </DroppableColumn>
                </SortableContext>
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-gray-700 rounded-lg p-3 shadow-lg ring-2 ring-purple-500 border border-gray-600">
                <div className="flex items-start gap-2">
                  <GripVertical size={18} className="text-gray-400 mt-1" />
                  <p className="text-gray-100 flex-1">
                    {Object.values(tasks)
                      .flat()
                      .find(task => task.taskId === activeId)?.text}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default KanbanBoard;