"use client";

import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StockTab } from "@/components/inventory/stock-tab";
import { MovementsTab } from "@/components/inventory/movements-tab";

export default function InventoryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        description="Ingredients on hand, low-stock alerts and every stock movement — sales deduct automatically from recipes."
        icon={Package}
      />
      <Tabs defaultValue="stock" className="gap-4">
        <TabsList className="h-10 bg-secondary">
          <TabsTrigger value="stock" className="px-4">
            Stock
          </TabsTrigger>
          <TabsTrigger value="movements" className="px-4">
            Movements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <StockTab />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
