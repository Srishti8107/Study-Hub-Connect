import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { memo } from "react";
import logo from '@/components/assets/logo.png';

interface ClassFilterProps {
  selectedClass: string | null;
  onSelectClass: (classValue: string | null) => void;
  classCounts: { class: string; count: number }[];
}

export const ClassFilter = memo(function ClassFilter({ selectedClass, onSelectClass, classCounts }: ClassFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
        <img src={logo} className="h-6 w-6 sm:h-8 sm:w-8 text-primary"/>
        <span className="font-medium hidden sm:inline">Filter by Class:</span>
        <span className="font-medium sm:hidden">Class:</span>
      </div>
      
      <Button
        variant={selectedClass === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelectClass(null)}
        className="h-7 sm:h-8 text-xs sm:text-sm"
      >
        All
        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
          {classCounts.reduce((acc, c) => acc + c.count, 0)}
        </Badge>
      </Button>

      {classCounts.map(({ class: classValue, count }) => (
        <Button
          key={classValue}
          variant={selectedClass === classValue ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectClass(classValue)}
          className="h-7 sm:h-8 text-xs sm:text-sm"
        >
          {classValue}
          <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
            {count}
          </Badge>
        </Button>
      ))}
    </div>
  );
});
