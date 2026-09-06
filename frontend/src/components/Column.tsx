import { useDroppable } from '@dnd-kit/core';
import type { ColumnConfig, Task } from '../types';
import { isAdjacentMove } from '../types';
import TaskCard from './TaskCard';

import { Edit2, Trash2 } from 'lucide-react';

interface ColumnProps {
  config: ColumnConfig;
  tasks: Task[];
  activeTask: Task | null;
  onEdit: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
  onEditColumn?: (id: string, newTitle: string) => void;
  onDeleteColumn?: (id: string) => void;
}

export default function Column({ config, tasks, activeTask, onEdit, onRequestDelete, onEditColumn, onDeleteColumn }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  const isDropTarget = !!activeTask && activeTask.status !== config.id;
  const isInvalid = isOver && !!activeTask && !isAdjacentMove(activeTask.status, config.id);
  const isValidHover = isOver && !isInvalid && isDropTarget;

  return (
    <div className="column">
      <div className="column-header">
        <div className="flex items-center justify-between w-full">
          <h3 className="flex-1 truncate pr-2">{config.title}</h3>
          <div className="flex items-center gap-1">
            <span className="column-count mr-2">{tasks.length}</span>
            {onEditColumn && (
              <button 
                onClick={() => {
                  const newTitle = prompt('Rename column:', config.title);
                  if (newTitle && newTitle !== config.title) onEditColumn(config.id, newTitle);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 transition-colors"
                title="Rename Column"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDeleteColumn && (
              <button 
                onClick={() => {
                  if (confirm(`Are you sure you want to delete the "${config.title}" column? Tasks inside will be lost unless you move them.`)) {
                    onDeleteColumn(config.id);
                  }
                }}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete Column"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      {config.hint && <p className="column-hint">{config.hint}</p>}

      <div
        ref={setNodeRef}
        className={[
          'column-drop-zone',
          isDropTarget ? 'is-droppable' : '',
          isValidHover ? 'is-hover-valid' : '',
          isInvalid ? 'is-hover-invalid' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {tasks.length === 0 ? (
          <div className="empty-state">
            <span>Nothing here yet</span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} onRequestDelete={onRequestDelete} />
          ))
        )}
      </div>
    </div>
  );
}
