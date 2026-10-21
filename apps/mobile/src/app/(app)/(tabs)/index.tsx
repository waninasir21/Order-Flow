import {
  ActivityIndicator,
  Button,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@apollo/client/react";
import { client } from "@/lib/apollo";
import { LOGOUT, OUTLETS, type Outlet } from "@/lib/graphql";
import { tokens } from "@/lib/storage";
import { useAuth } from "@/stores/auth";

export default function Outlets() {
  const { data, loading, error, refetch } = useQuery<{ outlets: Outlet[] }>(
    OUTLETS,
  );
  const [logoutMutation] = useMutation(LOGOUT);
  const { employee, signOut } = useAuth();

  const onLogout = async () => {
    const refreshToken = tokens.refresh;
    if (refreshToken)
      await logoutMutation({ variables: { refreshToken } }).catch(() => {}); // best effort
    signOut();
    await client.clearStore(); // next rep must not see this rep's cached data
  };

  if (loading && !data) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error) return <Text style={{ padding: 16 }}>Error: {error.message}</Text>;

  return (
    <FlatList
      data={data?.outlets ?? []}
      keyExtractor={(o) => o.id}
      onRefresh={() => refetch()}
      refreshing={loading}
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 18 }}>Hi {employee?.name}</Text>
          <Button title="Log out" onPress={onLogout} />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/outlet/${item.id}`)}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
          <Text>{item.address}</Text>
        </Pressable>
      )}
    />
  );
}
