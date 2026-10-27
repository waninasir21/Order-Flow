import { useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Card, EmptyState, ErrorState, Loading } from "@/components/ui";
import { OUTLETS } from "@/graphql/operations";
import type { Outlet } from "@/graphql/types";
import { describeError } from "@/lib/errors";
import { useThemedStyles, useTheme } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";

export default function OutletsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors: theme } = useTheme();
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
      }
      ListEmptyComponent={<EmptyState
          title="No outlets yet"
          message="No outlets are assigned to you yet. Ask an administrator to assign you some, then pull down to refresh."
        />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/outlet/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.address}. Open outlet`}
        >
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

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  name: { fontSize: 17, fontWeight: "600", color: colors.text },
  muted: { color: colors.muted, marginTop: 4, fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  });
