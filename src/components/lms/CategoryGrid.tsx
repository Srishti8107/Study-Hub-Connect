import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight} from "lucide-react";
import { memo } from "react";

interface CategoryCardProps {
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  videoCount: number;
  subjectCount: number;
  onClick: () => void;
}

export const CategoryCard = memo(function CategoryCard({ 
  name, 
  description, 
  color, 
  icon, 
  videoCount, 
  subjectCount,
  onClick 
}: CategoryCardProps) {
  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-2 hover:ring-2 hover:ring-primary/50"
    >
      <CardContent className="p-0">
        <div className={`relative h-40 bg-gradient-to-br ${color} p-6`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                {icon}
              </div>
              <ArrowRight className="h-6 w-6 text-white transition-transform group-hover:translate-x-1" />
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 backdrop-blur-sm">
                {subjectCount} Topics
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 backdrop-blur-sm">
                {videoCount} Videos
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <h3 className="font-bold text-2xl mb-2 group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  videoCount: number;
  subjectCount: number;
}

interface CategoryGridProps {
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryGrid = memo(function CategoryGrid({ categories, onSelectCategory }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          name={category.name}
          description={category.description}
          color={category.color}
          icon={category.icon}
          videoCount={category.videoCount}
          subjectCount={category.subjectCount}
          onClick={() => onSelectCategory(category.id)}
        />
      ))}
    </div>
  );
});
