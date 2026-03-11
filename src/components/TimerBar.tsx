'use client';

import TagPicker from '@/components/TagPicker';
import { useTimerBar } from './timer-bar/useTimerBar';
import { ProjectPicker } from './timer-bar/ProjectPicker';
import { CategoryTaskPicker } from './timer-bar/CategoryTaskPicker';
import { TimerControls } from './timer-bar/TimerControls';
import type { TimerBarProps } from './timer-bar/types';

export default function TimerBar({ onEntryChanged, playData, isBottomBar = false }: TimerBarProps) {
  const tb = useTimerBar({ onEntryChanged, playData });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
      {/* Popis – full width na mobilu, flex-1 na desktopu */}
      <input
        type="text"
        value={tb.description}
        onChange={(e) => tb.setDescription(e.target.value)}
        placeholder="Na čem pracuješ?"
        className="flex-1 min-w-0 px-3 py-1.5 sm:py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !tb.isRunning) tb.startTimer();
        }}
      />

      {/* Pickers + timer + tlačítka – druhý řádek na mobilu, pokračování řádku na desktopu */}
      <div className={`flex items-center ${isBottomBar ? 'gap-3' : 'gap-2 sm:gap-3'} flex-shrink-0`}>

        <ProjectPicker
          isBottomBar={isBottomBar}
          selectedProject={tb.selectedProject}
          selectedProjectObj={tb.selectedProjectObj}
          selectedProjectClientName={tb.selectedProjectClientName}
          projectPickerRef={tb.projectPickerRef}
          projectDropdownRef={tb.projectDropdownRef}
          showProjectPicker={tb.showProjectPicker}
          projectPickerPos={tb.projectPickerPos}
          projectSearch={tb.projectSearch}
          sortedClientEntries={tb.sortedClientEntries}
          filteredProjects={tb.filteredProjects}
          projects={tb.projects}
          setSelectedProject={tb.setSelectedProject}
          setShowProjectPicker={tb.setShowProjectPicker}
          setProjectSearch={tb.setProjectSearch}
          setProjectPickerPos={tb.setProjectPickerPos}
          setShowTaskPicker={tb.setShowTaskPicker}
          setTaskSearch={tb.setTaskSearch}
        />

        <CategoryTaskPicker
          isBottomBar={isBottomBar}
          selectedCategory={tb.selectedCategory}
          selectedTask={tb.selectedTask}
          selectedCategoryObj={tb.selectedCategoryObj}
          selectedTaskObj={tb.selectedTaskObj}
          taskPickerRef={tb.taskPickerRef}
          taskDropdownRef={tb.taskDropdownRef}
          showTaskPicker={tb.showTaskPicker}
          taskPickerPos={tb.taskPickerPos}
          taskSearch={tb.taskSearch}
          taskStructure={tb.taskStructure}
          orphanTasks={tb.orphanTasks}
          categories={tb.categories}
          tasks={tb.tasks}
          setSelectedCategory={tb.setSelectedCategory}
          setSelectedTask={tb.setSelectedTask}
          setShowTaskPicker={tb.setShowTaskPicker}
          setTaskSearch={tb.setTaskSearch}
          setTaskPickerPos={tb.setTaskPickerPos}
          setShowProjectPicker={tb.setShowProjectPicker}
          setProjectSearch={tb.setProjectSearch}
        />

        {/* Tag picker */}
        <TagPicker selectedTagIds={tb.selectedTags} onChange={tb.setSelectedTags} />

        <TimerControls
          isBottomBar={isBottomBar}
          isRunning={tb.isRunning}
          elapsed={tb.elapsed}
          validationError={tb.validationError}
          isOnline={tb.isOnline}
          offlinePendingMsg={tb.offlinePendingMsg}
          formatTime={tb.formatTime}
          startTimer={tb.startTimer}
          stopTimer={tb.stopTimer}
          discardTimer={tb.discardTimer}
        />

      </div>{/* /pickers row */}
    </div>
  );
}
