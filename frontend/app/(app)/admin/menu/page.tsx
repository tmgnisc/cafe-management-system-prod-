"use client";

import { ChefHat } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { MenuItemsTab } from "@/components/menu/menu-items-tab";
import { CategoriesTab } from "@/components/menu/categories-tab";
import { RecipesTab } from "@/components/menu/recipes-tab";

export default function MenuPage() {
  return (
    <PageContainer>
      <PageHeader title="Menu & Recipes" description="Manage what you sell, how it's grouped, and which ingredients each serving uses." icon={ChefHat} />
      <Tabs defaultValue="items" className="gap-4">
        <TabsList className="h-10 bg-secondary">
          <TabsTrigger value="items" className="px-4">
            Menu items
          </TabsTrigger>
          <TabsTrigger value="categories" className="px-4">
            Categories
          </TabsTrigger>
          <TabsTrigger value="recipes" className="px-4">
            Recipes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <MenuItemsTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
