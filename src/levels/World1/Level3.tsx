import React from 'react';
import BaseLevel from '../BaseLevel';

const questions = [
  {
    question: 'Pregunta de ejemplo para Mundo 1 Nivel 3',
    options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
    correct: 0,
    explanation: 'Explicación de ejemplo.'
  }
];

export default function World1Level3() {
  return (
    <BaseLevel
      worldId={1}
      levelId={3}
      levelName="Nivel 3 del Mundo 1"
      questions={questions}
    />
  );
}
