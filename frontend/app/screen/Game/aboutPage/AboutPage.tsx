import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import CloseButton from "../common/CloseButton";

type ContentItem = {
  id: number;
  title: string;
  paragraphs: string[];
  icon: string;
  accentColor: string;
};

const AboutPage: React.FC = () => {
  const router = useRouter();

  const handleReturnToMain = () => {
    router.back();
  };

  const content: ContentItem[] = [
    {
      id: 1,
      icon: "🎮",
      title: "How to Play",
      accentColor: "#10b981",
      paragraphs: [
        "Welcome to Roti & Ringgit, where you are a savvy trader navigating bustling Malaysian markets. Your goal is to buy and sell items at various markets, earning a profit as you leverage differences in prices at the various spots to build your peddling business into a one-person mercantile empire.",
        "It's up to you to build your fortune and save enough for retirement, so don't waste a day. Time moves a little slower in here. Each turn is 1 day. What you choose to do with it, whether that's buying or selling something or traveling, that's entirely up to you. If you choose to travel to another market, that can take multiple days.",
        "Keep your eyes open for profit opportunities. In addition to price differences between cities, prices will fluctuate slightly over time in each local market. Some items are seasonal, so selling an item out of season can fetch a handsome return.",
      ],
    },
    {
      id: 2,
      icon: "🛒",
      title: "Buying and Selling",
      accentColor: "#f59e0b",
      paragraphs: [
        "Click on the Market tab to see which items are on offer in this location. Bear in mind that not all items are available for sale or purchase at every market, so keep track of the prices as you travel from place to place. Great opportunities may be hidden in tiny details.",
        "Click on the Buy tab to purchase items or the Sell tab to offer items from your inventory at the going rate for that market. Each item will have a name, price and the quantity of product on hand. How much you can buy depends on your available cash as well as your carrying capacity. Keep track of your used and available capacity, both weight and volume. After making some money, you may be able to afford an upgrade or two that will increase your capacity. If you want to purchase the maximum allowable amount, click the Max button if it is available.",
        "To sell an item, click on your Inventory to check through your items and see what price others may be willing to pay. You can enter the quantity to sell or click the Max button to sell everything.",
      ],
    },
    {
      id: 3,
      icon: "✈️",
      title: "Traveling the Roti Markets",
      accentColor: "#3b82f6",
      paragraphs: [
        "To monetize the price differentials between areas, you'll need to do some traveling. Click the Travel button to open a map of the available locations. As you advance in prominence and wealth, you may have an opportunity to purchase upgraded maps that give you access to new cities. Some cities are close by and may only take 1 or 2 days of travel. Others may be further apart. Often, but not always, these far-flung locations have wider price disparities and, consequently, more opportunity for profit.",
        "Travel can be dangerous, even between locations that are not very far apart. For each day of travel, you roll for a chance encounter. If you roll high, you have an uneventful travel day. On the other hand, a low roll could lead to a bandit attack or rock slide. Depending on the calamity you face, you could lose a portion of your cash, some of your inventory, or delay you for several days. As your business grows, you can invest in spendable upgrades in the Tools section that can help you escape these dangers as they arise.",
      ],
    },
    {
      id: 4,
      icon: "🏦",
      title: "Banking",
      accentColor: "#8b5cf6",
      paragraphs: [
        "Each location you visit will have a branch of the main Roti & Ringgit Bank where you can store your money for use later and take out or repay loans. Saving money helps prevent large losses when you encounter bandits or charlatans on the road while traveling. Since each branch is connected via couriers and carrier pigeons, they operate as a single entity. So, you can deposit money in one city and withdraw it again in another.",
        "Loans are a great way to kick-start a thriving business on the Roti Road. As you might imagine, though, this kind of financial boost comes at a cost. The fee for each loan is added to the principle from the start, and you have a set amount of time to pay it back. If you miss the due date, bad things happen, so do not miss the due date. Also, all loans count against your net wealth. At the end of your limited time on the Roti Road, you want enough net wealth to retire comfortably, and you can't do that with a bunch of outstanding loans.",
      ],
    },
    {
      id: 5,
      icon: "🎖️",
      title: "Guilds",
      accentColor: "#ec4899",
      paragraphs: [
        "As your travels on the Roti Road allow you to gather a small fortune, you may be ready to jump to the next step in your journey to a happy retirement. Now a thriving entrepreneur, you will have an opportunity to rise to the ranks of the elite mercantile guilds. Each city or village has its own guild with their own specialties and interests.",
        "By paying the entry fee, you may have access to special discounts on certain items. For tools and upgrades, some items may be marked 'guild only' so you can only purchase them by joining the ranks of the mercantile elite for that area. Now that you're well on your way to the highest strata of power and affluence, it's time to throw off your dusty peddler's coat in exchange for a suit of the finest silk. Join a guild today!",
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={require("@/assets/images/about.png")}
        style={{ flex: 1 }}
        imageStyle={{ opacity: 0.25 }}
      >
        {/* Header with warm gradient overlay */}
        <LinearGradient
          colors={["rgba(28, 25, 23, 0.95)", "rgba(28, 25, 23, 0.7)", "transparent"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.subtitle}>✨ Welcome to ✨</Text>
              <Text style={styles.title}>Roti & Ringgit</Text>
              <Text style={styles.tagline}>Your Malaysian Trading Adventure</Text>
              <View style={styles.titleUnderline} />
            </View>
            <View style={styles.closeButton}>
              <CloseButton handleClose={handleReturnToMain} />
            </View>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.contentWrapper}>
            {content.map((section, index) => (
              <View key={section.id} style={styles.sectionWrapper}>
                {/* Glassmorphic card effect */}
                <LinearGradient
                  colors={["rgba(41, 37, 36, 0.92)", "rgba(28, 25, 23, 0.88)"]}
                  style={styles.section}
                >
                  {/* Decorative corner accent */}
                  <View style={[styles.cornerAccent, { backgroundColor: section.accentColor }]} />
                  
                  {/* Icon badge with glow effect */}
                  <View style={styles.iconBadgeWrapper}>
                    <View style={[styles.iconGlow, { backgroundColor: section.accentColor }]} />
                    <View style={[styles.iconBadge, { backgroundColor: section.accentColor + "30", borderColor: section.accentColor }]}>
                      <Text style={styles.sectionIcon}>{section.icon}</Text>
                    </View>
                  </View>

                  {/* Content */}
                  <View style={styles.sectionContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <View style={styles.sectionNumber}>
                        <Text style={[styles.sectionNumberText, { color: section.accentColor }]}>{index + 1}</Text>
                      </View>
                    </View>
                    
                    {section.paragraphs.map((text, idx) => (
                      <View key={idx} style={styles.paragraphContainer}>
                        <View style={[styles.bulletOuter, { borderColor: section.accentColor }]}>
                          <View style={[styles.bulletInner, { backgroundColor: section.accentColor }]} />
                        </View>
                        <Text style={styles.paragraph}>{text}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Bottom accent bar */}
                  <View style={[styles.bottomAccent, { backgroundColor: section.accentColor }]} />
                </LinearGradient>
              </View>
            ))}

            {/* End decoration */}
            <View style={styles.endDecoration}>
              <Text style={styles.endText}>🎯 Good Luck on Your Roti Journey! 🎯</Text>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

export default AboutPage;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#1c1917" 
  },
  headerGradient: {
    paddingBottom: 24,
  },
  header: { 
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: "center", 
    justifyContent: "center", 
    position: "relative" 
  },
  titleContainer: {
    alignItems: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#d97706",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
    fontWeight: "600",
  },
  title: { 
    fontSize: 40, 
    fontWeight: "900", 
    textAlign: "center", 
    color: "#d97706",
    textShadowColor: "rgba(217, 119, 6, 0.6)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 13,
    color: "#a8a29e",
    letterSpacing: 1.5,
    marginTop: 6,
    fontStyle: "italic",
  },
  titleUnderline: {
    width: 80,
    height: 4,
    backgroundColor: "#d97706",
    marginTop: 12,
    borderRadius: 2,
    shadowColor: "#d97706",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  closeButton: { 
    position: "absolute", 
    right: 20, 
    top: 28,
    zIndex: 10,
  },
  scrollContainer: { 
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  contentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionWrapper: {
    marginBottom: 18,
  },
  section: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(251, 191, 36, 0.15)",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    position: "relative",
  },
  cornerAccent: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    opacity: 0.15,
    transform: [{ rotate: "45deg" }],
  },
  iconBadgeWrapper: {
    position: "absolute",
    top: 24,
    left: 20,
    zIndex: 3,
  },
  iconGlow: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    opacity: 0.2,
    top: -4,
    left: -4,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    backgroundColor: "rgba(254, 243, 199, 0.15)",
  },
  sectionIcon: { 
    fontSize: 34,
  },
  sectionContent: {
    padding: 20,
    paddingTop: 105,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  sectionTitle: { 
    fontSize: 26, 
    fontWeight: "900", 
    color: "#fef3c7",
    letterSpacing: 0.5,
    flex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  paragraphContainer: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  bulletOuter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginRight: 14,
    flexShrink: 0,
  },
  bulletInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  paragraph: { 
    fontSize: 15, 
    color: "#e2e8f0", 
    lineHeight: 24,
    flex: 1,
  },
  sectionNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(41, 37, 36, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.3)",
    marginLeft: 12,
  },
  sectionNumberText: {
    fontSize: 18,
    fontWeight: "900",
  },
  bottomAccent: {
    height: 5,
    width: "100%",
    opacity: 0.7,
  },
  endDecoration: {
    alignItems: "center",
    paddingVertical: 24,
    marginTop: 8,
  },
  endText: {
    fontSize: 16,
    color: "#fbbf24",
    fontWeight: "700",
    textShadowColor: "rgba(251, 191, 36, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});