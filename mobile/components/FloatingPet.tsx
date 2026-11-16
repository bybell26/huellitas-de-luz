import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import PetSVG from './PetSVG';
import { getBreed, type Species } from '../constants/pets';
import { Colors } from '../constants/theme';

interface Pet {
  id: string;
  species: Species;
  breed: string;
  collar: string;
  name: string;
}

interface FloatingPetProps {
  pet: Pet;
  size?: number;
  isNew?: boolean;
}

export default function FloatingPet({ pet, size = 120, isNew = false }: FloatingPetProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(isNew ? 0.3 : 1);
  const opacity = useSharedValue(isNew ? 0 : 1);

  const breed = getBreed(pet.species, pet.breed);

  useEffect(() => {
    // Float loop: -12 → 0 → -12, ease in-out, 2200ms per half-cycle
    translateY.value = withRepeat(
      withTiming(-12, {
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    // Entrance animation for new pets
    if (isNew) {
      scale.value = withSpring(1, { damping: 12, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 800 });
    }
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={floatStyle}>
        <PetSVG
          species={pet.species}
          breedId={pet.breed}
          collar={pet.collar}
          name={pet.name}
          size={size}
        />
      </Animated.View>
      <View style={styles.tag}>
        <Text style={styles.tagName} numberOfLines={1}>{pet.name}</Text>
        <Text style={styles.tagBreed} numberOfLines={1}>{breed.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#111d36',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 6,
    alignItems: 'center',
  },
  tagName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tagBreed: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '500',
  },
});
