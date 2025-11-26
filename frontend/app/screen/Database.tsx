import React, { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import { readUser, saveUser } from "../../database";

type User = {
  username: string;
  email: string;
};

const Database = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Read user from Firestore
    const fetchUser = async () => {
      const data = await readUser("1");
      setUser(data as User | null);
    };
    fetchUser();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button
        title="Save User"
        onPress={async () => {
          await saveUser("1", "John", "john@example.com");
          const updated = await readUser("1");
          setUser(updated as User | null);
        }}
      />
      {user ? (
        <Text>
          User: {user.username}, Email: {user.email}
        </Text>
      ) : (
        <Text>No user data</Text>
      )}
    </View>
  );
};

export default Database;
