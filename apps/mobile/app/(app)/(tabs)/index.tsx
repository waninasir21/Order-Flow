import { useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Card, EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { OUTLETS } from "@/graphql/operations";
import type { Outlet } from "@/graphql/types";
import { describeError } from "@/lib/errors";

export default function OutletsScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useQuery<{ outlets: Outlet[] }>(OUTLETS);
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={describeError(error)} onRetry={() => void refetch()} />;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data?.outlets ?? []}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState message="No outlets are assigned to you yet." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/outlet/${item.id}`)}>
          <Card>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>{item.address}</Text>
            <View style={styles.row}>
              <Text style={styles.muted}>{item.ownerName}</Text>
              <Text style={styles.muted}>{item.phone}</Text>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  name: { fontSize: 17, fontWeight: "600", color: colors.text },
  muted: { color: colors.muted, marginTop: 4, fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
